"""
Proxy endpoints — forward requests to Jellyfin using the authenticated user's token.
The frontend sends its Jellyfin token in the X-Jellyfin-Token header.
"""
from typing import Any

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
        "Fields": "Overview,Genres,People,MediaStreams,RunTimeTicks",
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
        params={"Fields": "Overview,Genres,People,MediaStreams,RunTimeTicks,BackdropImageTags"},
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
