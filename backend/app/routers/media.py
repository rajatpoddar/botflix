"""
Proxy endpoints — forward requests to Jellyfin using the authenticated user's token.
The frontend sends its Jellyfin token in the X-Jellyfin-Token header.
"""
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse, Response

from app import jellyfin as jf
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/api/media", tags=["media"])


def _require_jf_token(x_jellyfin_token: str | None = Header(default=None)) -> str:
    if not x_jellyfin_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jellyfin token missing (X-Jellyfin-Token header)",
        )
    return x_jellyfin_token


def _hls_auth_headers() -> dict:
    """Server-side auth header for proxying HLS manifests/segments."""
    from app.config import settings

    return {
        "X-Emby-Authorization": (
            f'MediaBrowser Client="VOD Platform", Device="Proxy", '
            f'DeviceId="vod-backend", Version="1.0.0", Token="{settings.JELLYFIN_API_KEY}"'
        ),
    }


@router.get("/latest")
async def get_latest(
    limit: int = Query(default=20, le=50),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Recently added items across all libraries."""
    return await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Items/Latest",
        jf_token,
        params={"Limit": limit, "Fields": "Overview,Genres,People,MediaStreams"},
    )


@router.get("/categories")
async def get_categories(
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Top-level library views (categories)."""
    return await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Views",
        jf_token,
    )


@router.get("/libraries")
async def get_libraries(
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return media library folders visible to this user."""
    data = await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Views",
        jf_token,
    )
    items = data.get("Items", [])
    # Only return actual media libraries (not channel/livetv virtual folders)
    media_types = {"movies", "tvshows", "music", "mixed", "boxsets", "unknown"}
    libraries = [
        {"Id": it["Id"], "Name": it["Name"], "CollectionType": it.get("CollectionType", "unknown")}
        for it in items
        if it.get("CollectionType", "unknown").lower() in media_types
    ]
    return libraries


@router.get("/items")
async def get_items(
    parent_id: str | None = Query(default=None),
    include_item_types: str = Query(default="Movie"),
    sort_by: str = Query(default="DateCreated"),
    sort_order: str = Query(default="Descending"),
    limit: int = Query(default=20, le=100),
    start_index: int = Query(default=0),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Paginated item list — supports browsing movies, shows, etc."""
    params: dict = {
        "IncludeItemTypes": include_item_types,
        "SortBy": sort_by,
        "SortOrder": sort_order,
        "Limit": limit,
        "StartIndex": start_index,
        "Recursive": True,
        "Fields": "Overview,Genres,People,MediaStreams,RunTimeTicks,UserData",
    }
    if parent_id:
        params["ParentId"] = parent_id

    return await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Items",
        jf_token,
        params=params,
    )


@router.get("/item/{item_id}")
async def get_item(
    item_id: str,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Single item metadata."""
    return await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Items/{item_id}",
        jf_token,
        params={"Fields": "Overview,Genres,People,MediaStreams,RunTimeTicks,BackdropImageTags,UserData"},
    )


@router.get("/stream-url/{item_id}")
async def get_stream_url(
    item_id: str,
    audio_stream_index: int | None = Query(default=None),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return the direct-stream URL for the player.
    Supports optional audio_stream_index to select a specific audio track.
    """
    from app.config import settings

    # Remove static=true so Jellyfin dynamically transcodes to a format
    # the client supports — critical for mobile browsers that may not
    # support codecs like H.265.
    stream_url = (
        f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/stream"
        f"?api_key={jf_token}"
    )
    if audio_stream_index is not None:
        stream_url += f"&AudioStreamIndex={audio_stream_index}"

    return {"stream_url": stream_url, "item_id": item_id, "audio_stream_index": audio_stream_index}


@router.get("/proxy-stream/{item_id}")
async def proxy_video_stream(
    item_id: str,
    audio_stream_index: int | None = Query(default=None),
    token: str | None = Query(default=None),
    static: bool = Query(default=False),
    range_header: str | None = Header(default=None, alias="range"),
):
    """
    Proxy video stream from Jellyfin through our backend.
    Uses our own JWT token (passed as ?token=xxx query param) for authentication —
    critical because <video> elements can't send custom headers.

    This ensures mobile devices only need to reach our backend,
    not the Jellyfin server directly.
    Supports HTTP Range requests for seeking.

    When static=true, serves the raw file (Jellyfin sends Content-Length).
    Used for downloads where real progress tracking is needed.
    """
    from app.config import settings
    from app.security import decode_access_token

    # Authenticate via our own JWT token (passed as ?token=xxx in query)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token required")

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # ── Build Jellyfin stream URL ───────────────────────────────────────
    # By default (static=false): dynamic streaming endpoint remuxes/transcodes
    # audio to AAC — browser-compatible for all files.
    # static=true: serves raw file as-is (returns Content-Length for progress).
    # Auth via X-Emby-Authorization header (server API key).
    stream_url = f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/stream"
    params_list = ["AudioCodec=aac", "MaxAudioChannels=2"]
    if static:
        params_list = ["static=true"]
    if audio_stream_index is not None:
        params_list.append(f"AudioStreamIndex={audio_stream_index}")
    stream_url += "?" + "&".join(params_list)

    auth_headers = {
        "X-Emby-Authorization": (
            f'MediaBrowser Client="VOD Platform", Device="Proxy", '
            f'DeviceId="vod-backend", Version="1.0.0", Token="{settings.JELLYFIN_API_KEY}"'
        ),
    }

    # ── Pass through Range header for seeking ───────────────────────────
    if range_header:
        auth_headers["Range"] = range_header

    # ── Stream directly from Jellyfin (no HEAD probe) ───────────────────
    # The HEAD probe added a full round-trip on every seek — eliminated.
    # Instead, send a streaming GET and read the response headers (status,
    # Content-Type, Content-Range, Content-Length) from Jellyfin's actual
    # response before piping the body through.
    # This cuts seek latency in half: 1 round trip instead of 2.
    client = httpx.AsyncClient(timeout=None)
    try:
        request = client.build_request("GET", stream_url, headers=auth_headers)
        jellyfin_resp = await client.send(request, stream=True)

        resp_status = jellyfin_resp.status_code
        ct = jellyfin_resp.headers.get("content-type", "video/mp4")
        cl = jellyfin_resp.headers.get("content-length")
        cr = jellyfin_resp.headers.get("content-range")

        if resp_status >= 400:
            body = await jellyfin_resp.aread()
            logger.error(
                "Jellyfin stream error %s for item %s: %s",
                resp_status, item_id, body[:500],
            )
            await client.aclose()
            return Response(
                status_code=status.HTTP_502_BAD_GATEWAY,
                content="Stream unavailable from upstream server",
            )

        # Build response headers passing through key metadata from Jellyfin.
        # Always advertise Accept-Ranges so the browser knows to send Range
        # requests for seeking. Jellyfin's dynamic endpoint handles these
        # correctly — it seeks in the source file and remuxes from the
        # requested position, returning 206 with proper Content-Range.
        response_headers = {"Accept-Ranges": "bytes"}
        if cr:
            response_headers["Content-Range"] = cr
        if cl:
            response_headers["Content-Length"] = cl

        async def _stream():
            try:
                async for chunk in jellyfin_resp.aiter_bytes(chunk_size=262144):
                    yield chunk
            finally:
                await client.aclose()

        return StreamingResponse(
            _stream(),
            status_code=resp_status,
            media_type=ct,
            headers=response_headers,
        )
    except Exception:
        await client.aclose()
        raise


@router.get("/hls/{item_id}/main.m3u8")
async def get_hls_manifest(
    item_id: str,
    audio_stream_index: int | None = Query(default=None),
    token: str | None = Query(default=None),
):
    """
    Proxy Jellyfin's HLS manifest for an item.

    HLS segments the media into small finite chunks, so seeking and resume
    jump straight to the target segment instead of restarting a progressive
    transcode from scratch (which is what made the old /proxy-stream endpoint
    slow to seek/resume).

    The returned manifest's segment URIs are rewritten to point back at our
    own /segment proxy (carrying the JWT token) so the browser only ever
    talks to our backend and never needs to reach Jellyfin directly.
    """
    import urllib.parse
    import uuid

    from app.config import settings
    from app.security import decode_access_token

    if not token or not decode_access_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    params = {
        "MediaSourceId": item_id,
        "PlaySessionId": uuid.uuid4().hex,
        "VideoCodec": "h264",
        "AudioCodec": "aac",
        "SubtitleCodec": "vtt",
        "VideoBitrate": "8000000",
        "AudioBitrate": "192000",
        "MaxAudioChannels": "2",
        "SegmentContainer": "ts",
        "MinSegments": "1",
        "BreakOnNonKeyFrames": "true",
        "api_key": settings.JELLYFIN_API_KEY,
    }
    if audio_stream_index is not None:
        params["AudioStreamIndex"] = str(audio_stream_index)

    url = f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/main.m3u8"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params, headers=_hls_auth_headers())
        if resp.status_code >= 400:
            logger.error(
                "HLS manifest error %s for item %s: %s",
                resp.status_code, item_id, resp.text[:500],
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not load HLS manifest from upstream server",
            )
        manifest = resp.text

    # Rewrite each segment URI to a relative path pointing at our segment
    # proxy. Relative URIs resolve against the manifest URL
    # (.../hls/{item_id}/main.m3u8) → .../hls/{item_id}/segment?...
    out_lines: list[str] = []
    for line in manifest.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            out_lines.append(line)
            continue
        encoded = urllib.parse.quote(stripped, safe="")
        out_lines.append(f"segment?path={encoded}&token={token}")

    body = "\n".join(out_lines) + "\n"
    return Response(content=body, media_type="application/vnd.apple.mpegurl")


@router.get("/hls/{item_id}/segment")
async def get_hls_segment(
    item_id: str,
    path: str,
    token: str | None = Query(default=None),
    range_header: str | None = Header(default=None, alias="range"),
):
    """Proxy a single HLS segment (finite .ts file) through our backend."""
    from app.config import settings
    from app.security import decode_access_token

    if not token or not decode_access_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Resolve the segment URI (from the rewritten manifest) against Jellyfin.
    # Our manifest only ever emits relative URIs, so we intentionally do NOT
    # honor absolute http(s) paths here — that would be an SSRF vector letting
    # a token holder proxy arbitrary internal URLs through the backend.
    if path.startswith(("http://", "https://")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid segment path")
    if path.startswith("/"):
        seg_url = f"{settings.JELLYFIN_SERVER_URL}{path}"
    else:
        seg_url = f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/{path}"

    headers = _hls_auth_headers()
    if range_header:
        headers["Range"] = range_header

    client = httpx.AsyncClient(timeout=None)
    try:
        request = client.build_request("GET", seg_url, headers=headers)
        upstream = await client.send(request, stream=True)

        if upstream.status_code >= 400:
            body = await upstream.aread()
            logger.error(
                "HLS segment error %s for item %s: %s",
                upstream.status_code, item_id, body[:300],
            )
            await client.aclose()
            return Response(status_code=status.HTTP_502_BAD_GATEWAY, content="Segment unavailable")

        media_type = upstream.headers.get("content-type", "video/mp2t")
        response_headers = {}
        for h in ("content-length", "content-range", "accept-ranges"):
            if h in upstream.headers:
                response_headers[h] = upstream.headers[h]

        async def _stream():
            try:
                async for chunk in upstream.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await client.aclose()

        return StreamingResponse(
            _stream(),
            status_code=upstream.status_code,
            media_type=media_type,
            headers=response_headers,
        )
    except Exception:
        await client.aclose()
        raise


@router.get("/subtitles/{item_id}/{stream_index}")
async def proxy_subtitles(
    item_id: str,
    stream_index: int,
    token: str | None = Query(default=None),
):
    """
    Proxy subtitle files (VTT) from Jellyfin through our backend.
    Uses our own JWT token (?token=xxx) for authentication — critical because
    <track> elements can't send custom headers and the browser may not be able
    to reach the Jellyfin server directly.

    Tries multiple URL variants since Jellyfin's mediaSourceId may differ from
    the item ID. First tries item_id as mediaSourceId (most common), and if
    that fails, tries without mediaSourceId.
    """
    from app.config import settings
    from app.security import decode_access_token

    if not token or not decode_access_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    headers = _hls_auth_headers()

    # Try multiple subtitle URL formats. The most common is
    # /Videos/{itemId}/{itemId}/Subtitles/{index}/Stream.vtt
    # but some items have a different mediaSourceId.
    urls_to_try = [
        f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/{item_id}/Subtitles/{stream_index}/Stream.vtt",
        f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/Subtitles/{stream_index}/Stream.vtt",
    ]

    async with httpx.AsyncClient(timeout=30) as client:
        for sub_url in urls_to_try:
            resp = await client.get(sub_url, headers=headers)
            if resp.is_success:
                # Return VTT with proper content type and CORS headers
                return Response(
                    content=resp.content,
                    media_type="text/vtt; charset=utf-8",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=3600",
                    },
                )

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Subtitle unavailable",
    )


@router.get("/download-url/{item_id}")
async def get_download_url(
    item_id: str,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return a redirect URL to the Jellyfin stream for downloading."""
    from app.config import settings

    # Direct Jellyfin stream URL with admin API key — browser handles the download
    download_url = (
        f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/stream"
        f"?static=true&api_key={settings.JELLYFIN_API_KEY}&download=true"
    )

    return {
        "download_url": download_url,
        "item_id": item_id,
    }


@router.get("/seasons/{series_id}")
async def get_seasons(
    series_id: str,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return all seasons for a TV series."""
    return await jf.proxy_jellyfin(
        f"Shows/{series_id}/Seasons",
        jf_token,
        params={
            "userId": current_user.jellyfin_user_id,
            "Fields": "Overview,ImageTags",
        },
    )


@router.get("/episodes/{series_id}")
async def get_episodes(
    series_id: str,
    season_id: str | None = Query(default=None),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return episodes for a TV series, optionally filtered by season."""
    params: dict = {
        "userId": current_user.jellyfin_user_id,
        "Fields": "Overview,RunTimeTicks,MediaStreams,ImageTags,UserData",
    }
    if season_id:
        params["seasonId"] = season_id

    return await jf.proxy_jellyfin(
        f"Shows/{series_id}/Episodes",
        jf_token,
        params=params,
    )


@router.get("/similar/{item_id}")
async def get_similar(
    item_id: str,
    limit: int = Query(default=12, le=30),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return similar/related items for a given movie or show.
    Returns empty Items array on 404 (item has no similar entries).
    """
    try:
        return await jf.proxy_jellyfin(
            f"Users/{current_user.jellyfin_user_id}/Items/{item_id}/Similar",
            jf_token,
            params={
                "Limit": limit,
                "Fields": "Overview,Genres,RunTimeTicks,ImageTags",
            },
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"Items": [], "TotalRecordCount": 0}
        raise


@router.get("/continue-watching")
async def get_continue_watching(
    limit: int = Query(default=20, le=50),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Items the user has partially watched (for Continue Watching row)."""
    return await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Items/Resume",
        jf_token,
        params={
            "Limit": limit,
            "Recursive": True,
            "Fields": "Overview,Genres,MediaStreams,RunTimeTicks,UserData",
            "MediaTypes": "Video",
        },
    )


@router.post("/playback/start")
async def report_playback_started(
    payload: dict,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    No-op placeholder — Jellyfin's Sessions/Playing/Start doesn't exist in
    all server versions. We rely on the direct PlayingItems endpoint instead.
    """
    return {"status": "ok"}


@router.post("/playback/progress")
async def report_playback_progress(
    payload: dict,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Report playback progress to Jellyfin's Sessions API — this is the only
    reliable way to update UserData.PlaybackPositionTicks so Items/Resume works.
    """
    from app.config import settings

    item_id = payload.get("itemId")
    if not item_id:
        raise HTTPException(status_code=400, detail="itemId is required")

    position_ticks = payload.get("positionTicks", 0)
    is_paused = payload.get("isPaused", False)

    url = f"{settings.JELLYFIN_SERVER_URL}/Sessions/Playing/Progress"
    body = {
        "ItemId": item_id,
        "MediaSourceId": item_id,
        "PositionTicks": position_ticks,
        "IsPaused": is_paused,
        "PlayMethod": "DirectStream",
        "CanSeek": True,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json=body, headers=jf._user_headers(jf_token))
        if resp.status_code not in (200, 204):
            # Non-fatal — don't break playback for a reporting failure
            pass
    return {"status": "ok"}


@router.post("/playback/stop")
async def report_playback_stopped(
    payload: dict,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Report playback stopped — persists the resume position.
    Uses the direct PlayingItems endpoint to set PlaybackPositionTicks
    reliably (avoids depending on Sessions/Playing/Start which doesn't
    exist in all Jellyfin versions).
    """
    from app.config import settings

    item_id = payload.get("itemId")
    if not item_id:
        raise HTTPException(status_code=400, detail="itemId is required")

    position_ticks = payload.get("positionTicks", 0)

    async with httpx.AsyncClient(timeout=10) as client:
        # 1) Try the Sessions API (works on most servers, 204 = accepted)
        try:
            await client.post(
                f"{settings.JELLYFIN_SERVER_URL}/Sessions/Playing/Stopped",
                json={
                    "ItemId": item_id,
                    "MediaSourceId": item_id,
                    "PositionTicks": position_ticks,
                    "PlayMethod": "DirectStream",
                    "CanSeek": True,
                },
                headers=jf._user_headers(jf_token),
            )
        except Exception:
            pass

        # 2) Directly set playback position via PlayingItems endpoint.
        #    Only call when position_ticks > 0 — sending 0 would clear any
        #    previously saved resume position.
        if position_ticks > 0:
            playing_url = f"{settings.JELLYFIN_SERVER_URL}/PlayingItems/{item_id}?positionTicks={position_ticks}"
            try:
                playing_resp = await client.delete(playing_url, headers=jf._user_headers(jf_token))
                logger.info("PlayingItems delete for %s: %s", item_id, playing_resp.status_code)
            except Exception as exc:
                logger.warning("PlayingItems delete failed for %s: %s", item_id, exc)

    return {"status": "ok"}


# ── Watchlist (Favorites) ────────────────────────────────────────────────

@router.get("/watchlist")
async def get_watchlist(
    limit: int = Query(default=50, le=100),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return the user's favorited items (their watchlist)."""
    return await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Items",
        jf_token,
        params={
            "Filters": "IsFavorite",
            "Recursive": True,
            "IncludeItemTypes": "Movie,Series",
            "SortBy": "SortName",
            "SortOrder": "Ascending",
            "Limit": limit,
            "Fields": "Overview,Genres,RunTimeTicks,UserData",
        },
    )


@router.post("/watchlist/{item_id}")
async def add_to_watchlist(
    item_id: str,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Add an item to the user's watchlist (mark as favorite)."""
    from app.config import settings

    url = f"{settings.JELLYFIN_SERVER_URL}/Users/{current_user.jellyfin_user_id}/FavoriteItems/{item_id}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, headers=jf._user_headers(jf_token))
        if resp.status_code not in (200, 204):
            raise HTTPException(status_code=resp.status_code, detail="Failed to add to watchlist")
    return {"status": "ok", "favorite": True}


@router.delete("/watchlist/{item_id}")
async def remove_from_watchlist(
    item_id: str,
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Remove an item from the user's watchlist (unmark as favorite)."""
    from app.config import settings

    url = f"{settings.JELLYFIN_SERVER_URL}/Users/{current_user.jellyfin_user_id}/FavoriteItems/{item_id}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.delete(url, headers=jf._user_headers(jf_token))
        if resp.status_code not in (200, 204):
            raise HTTPException(status_code=resp.status_code, detail="Failed to remove from watchlist")
    return {"status": "ok", "favorite": False}


@router.get("/image/{item_id}")
async def proxy_image(
    item_id: str,
    image_type: str = Query(default="Primary", alias="type"),
    width: int = Query(default=400, ge=50, le=1920),
    quality: int = Query(default=90, ge=1, le=100),
    index: int | None = Query(default=None),
    token: str | None = Query(default=None),
):
    """
    Proxy Jellyfin images (posters, backdrops, etc.) through our backend.
    Uses our own JWT token (?token=xxx) for authentication — critical because
    <img> elements can't send custom headers and the browser may not be able to
    reach the Jellyfin server directly behind a domain/Cloudflare Tunnel.

    For **authenticated** users who have a valid JWT token.
    For public/unauthenticated access (e.g., landing page), use /public-image instead.
    """
    from app.config import settings
    from app.security import decode_access_token

    if not token or not decode_access_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Build Jellyfin image URL using server API key for auth
    if index is not None:
        img_url = f"{settings.JELLYFIN_SERVER_URL}/Items/{item_id}/Images/{image_type}/{index}"
    else:
        img_url = f"{settings.JELLYFIN_SERVER_URL}/Items/{item_id}/Images/{image_type}"
    img_url += f"?width={width}&quality={quality}"

    return await _pipe_jellyfin_image(img_url, item_id, image_type)


@router.get("/public-image/{item_id}")
async def proxy_public_image(
    item_id: str,
    image_type: str = Query(default="Primary", alias="type"),
    width: int = Query(default=400, ge=50, le=1920),
    quality: int = Query(default=90, ge=1, le=100),
    index: int | None = Query(default=None),
):
    """
    Public image proxy — no authentication required.
    Uses the server API key to proxy Jellyfin images.
    This is used by the landing page (before login) to display the
    poster collage background and Top 10 trending section.
    """
    from app.config import settings

    # Build Jellyfin image URL using server API key
    if index is not None:
        img_url = f"{settings.JELLYFIN_SERVER_URL}/Items/{item_id}/Images/{image_type}/{index}"
    else:
        img_url = f"{settings.JELLYFIN_SERVER_URL}/Items/{item_id}/Images/{image_type}"
    img_url += f"?width={width}&quality={quality}"

    return await _pipe_jellyfin_image(img_url, item_id, image_type)


async def _pipe_jellyfin_image(img_url: str, item_id: str, image_type: str) -> Response:
    """Shared logic: fetch an image from Jellyfin and stream it back."""
    from app.config import settings

    headers = {
        "X-Emby-Authorization": (
            f'MediaBrowser Client="VOD Platform", Device="Proxy", '
            f'DeviceId="vod-backend", Version="1.0.0", Token="{settings.JELLYFIN_API_KEY}"'
        ),
    }

    client = httpx.AsyncClient(timeout=30)
    try:
        request = client.build_request("GET", img_url, headers=headers)
        upstream = await client.send(request, stream=True)

        if upstream.status_code >= 400:
            body = await upstream.aread()
            logger.error(
                "Image proxy error %s for item %s type %s: %s",
                upstream.status_code, item_id, image_type, body[:300],
            )
            await client.aclose()
            return Response(status_code=status.HTTP_502_BAD_GATEWAY, content="Image unavailable")

        media_type = upstream.headers.get("content-type", "image/jpeg")
        response_headers = {}
        for h in ("content-length", "cache-control", "etag"):
            if h in upstream.headers:
                response_headers[h] = upstream.headers[h]
        # Cache images aggressively — they rarely change
        if "cache-control" not in response_headers:
            response_headers["Cache-Control"] = "public, max-age=86400"

        async def _stream():
            try:
                async for chunk in upstream.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await client.aclose()

        return StreamingResponse(
            _stream(),
            status_code=upstream.status_code,
            media_type=media_type,
            headers=response_headers,
        )
    except Exception:
        await client.aclose()
        raise


@router.get("/landing")
async def get_landing_data():
    """
    Public endpoint for the landing page — returns movie data without requiring auth.
    Uses the server API key to fetch:
    1. A batch of movies (for poster collage background)
    2. Top 10 trending/highest-rated movies
    This enables the Netflix-style hero collage and Top 10 section on the landing page.
    """
    from app.config import settings

    headers = {
        "X-Emby-Authorization": (
            f'MediaBrowser Client="VOD Platform", Device="Server", '
            f'DeviceId="vod-backend", Version="1.0.0", Token="{settings.JELLYFIN_API_KEY}"'
        ),
    }

    async with httpx.AsyncClient(timeout=20) as client:
        # 1) Fetch movies for poster collage (recently added, limit 20)
        collage_params = {
            "IncludeItemTypes": "Movie",
            "SortBy": "DateCreated",
            "SortOrder": "Descending",
            "Recursive": True,
            "Limit": 20,
            "Fields": "ImageTags",
            "ImageTypeLimit": 1,
        }
        collage_resp = await client.get(
            f"{settings.JELLYFIN_SERVER_URL}/Items",
            params=collage_params,
            headers=headers,
        )

        # 2) Fetch top rated movies for Trending section
        trending_params = {
            "IncludeItemTypes": "Movie",
            "SortBy": "CommunityRating",
            "SortOrder": "Descending",
            "Recursive": True,
            "Limit": 10,
            "Fields": "Overview,ImageTags,RunTimeTicks,CommunityRating,ProductionYear",
            "ImageTypeLimit": 1,
        }
        trending_resp = await client.get(
            f"{settings.JELLYFIN_SERVER_URL}/Items",
            params=trending_params,
            headers=headers,
        )

    collage_items = []
    if collage_resp.is_success:
        data = collage_resp.json()
        collage_items = [
            {
                "Id": item["Id"],
                "Name": item.get("Name", ""),
                "ImageTags": item.get("ImageTags", {}),
                "Type": item.get("Type", "Movie"),
            }
            for item in (data.get("Items", []) if isinstance(data, dict) else [])
            if item.get("ImageTags", {}).get("Primary")
        ]

    trending_items = []
    if trending_resp.is_success:
        data = trending_resp.json()
        trending_items = [
            {
                "Id": item["Id"],
                "Name": item.get("Name", ""),
                "Overview": item.get("Overview", ""),
                "ImageTags": item.get("ImageTags", {}),
                "CommunityRating": item.get("CommunityRating"),
                "ProductionYear": item.get("ProductionYear"),
                "RunTimeTicks": item.get("RunTimeTicks"),
                "Type": item.get("Type", "Movie"),
            }
            for item in (data.get("Items", []) if isinstance(data, dict) else [])
            if item.get("ImageTags", {}).get("Primary")
        ]

    return {
        "collage": collage_items,
        "trending": trending_items,
    }


@router.get("/search")
async def search(
    query: str = Query(..., min_length=1),
    limit: int = Query(default=20, le=50),
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Full-text search across all media."""
    return await jf.proxy_jellyfin(
        f"Users/{current_user.jellyfin_user_id}/Items",
        jf_token,
        params={
            "SearchTerm": query,
            "Recursive": True,
            "IncludeItemTypes": "Movie,Series,Episode",
            "Limit": limit,
            "Fields": "Overview,Genres",
        },
    )
