"""
Proxy endpoints — forward requests to Jellyfin using the authenticated user's token.
The frontend sends its Jellyfin token in the X-Jellyfin-Token header.
"""
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

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
    jf_token: str = Depends(_require_jf_token),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Return the direct-stream URL for the player."""
    from app.config import settings

    stream_url = (
        f"{settings.JELLYFIN_SERVER_URL}/Videos/{item_id}/stream"
        f"?static=true&api_key={jf_token}"
    )
    return {"stream_url": stream_url, "item_id": item_id}


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
