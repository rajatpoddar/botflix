"""
Async Jellyfin API client.
All calls that require admin privileges use the server-side API key.
Calls on behalf of a user use their Jellyfin AccessToken.
"""
from typing import Any

import httpx

from app.config import settings

_ADMIN_HEADERS = {
    "X-Emby-Authorization": (
        f'MediaBrowser Client="VOD Platform", Device="Server", '
        f'DeviceId="vod-backend", Version="1.0.0", Token="{settings.JELLYFIN_API_KEY}"'
    ),
    "Content-Type": "application/json",
}


def _user_headers(token: str) -> dict:
    return {
        "X-Emby-Authorization": (
            f'MediaBrowser Client="VOD Platform", Device="Browser", '
            f'DeviceId="vod-frontend", Version="1.0.0", Token="{token}"'
        ),
        "Content-Type": "application/json",
    }


async def create_jellyfin_user(username: str, password: str) -> dict[str, Any]:
    """Create a restricted user on the Jellyfin server."""
    url = f"{settings.JELLYFIN_SERVER_URL}/Users/New"
    payload = {"Name": username, "Password": password}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload, headers=_ADMIN_HEADERS)
        resp.raise_for_status()
        user_data = resp.json()

    # Apply restricted policy (no admin, limited to configured libraries)
    user_id = user_data["Id"]
    policy_url = f"{settings.JELLYFIN_SERVER_URL}/Users/{user_id}/Policy"
    policy = {
        "IsAdministrator": False,
        "IsDisabled": False,
        "EnableContentDownloading": False,
        "EnableMediaPlayback": True,
        "EnableAudioPlaybackTranscoding": True,
        "EnableVideoPlaybackTranscoding": True,
        "EnablePlaybackRemuxing": True,
        "EnableLiveTvAccess": False,
        "EnableLiveTvManagement": False,
        "EnableSharedDeviceControl": False,
        "EnableRemoteControlOfOtherUsers": False,
        "EnableUserPreferenceAccess": True,
        "EnableContentDeletion": False,
        "EnableSyncTranscoding": False,
        "EnableSubtitleManagement": False,
    }

    # Restrict to specific library folders if configured
    if settings.jellyfin_library_list:
        policy["EnabledFolders"] = settings.jellyfin_library_list
        policy["EnableAllFolders"] = False
    else:
        policy["EnableAllFolders"] = True

    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(policy_url, json=policy, headers=_ADMIN_HEADERS)

    return user_data


async def authenticate_jellyfin_user(username: str, password: str) -> dict[str, Any]:
    """Authenticate a user against Jellyfin and return the full auth response."""
    url = f"{settings.JELLYFIN_SERVER_URL}/Users/AuthenticateByName"
    payload = {"Username": username, "Pw": password}
    headers = {
        "X-Emby-Authorization": (
            'MediaBrowser Client="VOD Platform", Device="Browser", '
            'DeviceId="vod-frontend", Version="1.0.0"'
        ),
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def update_jellyfin_password(
    jellyfin_user_id: str, new_password: str
) -> None:
    """Reset a user's password via the admin API."""
    url = f"{settings.JELLYFIN_SERVER_URL}/Users/{jellyfin_user_id}/Password"
    payload = {"NewPw": new_password, "ResetPassword": True}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(url, json=payload, headers=_ADMIN_HEADERS)
        resp.raise_for_status()


async def proxy_jellyfin(
    endpoint: str,
    token: str,
    params: dict | None = None,
) -> Any:
    """Forward a GET request to Jellyfin using the user's token."""
    url = f"{settings.JELLYFIN_SERVER_URL}/{endpoint.lstrip('/')}"

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers=_user_headers(token), params=params or {})
        resp.raise_for_status()
        return resp.json()
