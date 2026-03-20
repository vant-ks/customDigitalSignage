"""
Dropbox API v2 storage adapter.
Uses short-lived access tokens + long-lived refresh tokens via PKCE-style flow.
"""

from typing import Optional

import httpx

from .base import FileEntry, FileListResult, StorageAdapter

DROPBOX_API = "https://api.dropboxapi.com/2"
DROPBOX_AUTH_URL = "https://api.dropbox.com/oauth2/token"

# MIME type heuristics from extension (Dropbox doesn't return mime_type in listing)
_EXT_MIME: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".htm": "text/html",
}


def _mime_from_name(name: str) -> Optional[str]:
    ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return _EXT_MIME.get(ext)


class DropboxAdapter(StorageAdapter):
    def __init__(self, credentials: dict):
        super().__init__(credentials)
        self._access_token: str = credentials.get("access_token", "")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._access_token}"}

    async def list_files(
        self, path: str = "/", cursor: Optional[str] = None
    ) -> FileListResult:
        async with httpx.AsyncClient(timeout=30) as client:
            if cursor:
                resp = await client.post(
                    f"{DROPBOX_API}/files/list_folder/continue",
                    headers=self._headers(),
                    json={"cursor": cursor},
                )
            else:
                # Dropbox root is "" not "/"
                dropbox_path = "" if path in ("/", "") else path
                resp = await client.post(
                    f"{DROPBOX_API}/files/list_folder",
                    headers=self._headers(),
                    json={
                        "path": dropbox_path,
                        "include_media_info": True,
                        "limit": 100,
                    },
                )
        resp.raise_for_status()
        data = resp.json()

        entries = []
        for item in data.get("entries", []):
            tag = item.get(".tag", "")
            entries.append(
                FileEntry(
                    name=item["name"],
                    path=item["path_lower"],
                    is_folder=(tag == "folder"),
                    size_bytes=item.get("size"),
                    modified_at=item.get("client_modified"),
                    mime_type=_mime_from_name(item["name"]) if tag == "file" else None,
                )
            )
        return FileListResult(
            entries=entries,
            cursor=data.get("cursor"),
            has_more=data.get("has_more", False),
        )

    async def get_file_metadata(self, path: str) -> FileEntry:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{DROPBOX_API}/files/get_metadata",
                headers=self._headers(),
                json={"path": path, "include_media_info": True},
            )
        resp.raise_for_status()
        item = resp.json()
        tag = item.get(".tag", "")
        return FileEntry(
            name=item["name"],
            path=item["path_lower"],
            is_folder=(tag == "folder"),
            size_bytes=item.get("size"),
            modified_at=item.get("client_modified"),
            mime_type=_mime_from_name(item["name"]) if tag == "file" else None,
        )

    async def get_download_url(self, path: str, expires_sec: int = 3600) -> str:
        # Dropbox temporary links last ~4 hours; expires_sec is advisory only
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{DROPBOX_API}/files/get_temporary_link",
                headers=self._headers(),
                json={"path": path},
            )
        resp.raise_for_status()
        return resp.json()["link"]

    async def refresh_credentials(
        self, client_id: str, client_secret: str
    ) -> dict:
        refresh_token = self.credentials.get("refresh_token", "")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                DROPBOX_AUTH_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
            )
        resp.raise_for_status()
        updated = dict(self.credentials)
        updated["access_token"] = resp.json()["access_token"]
        self.credentials = updated
        self._access_token = updated["access_token"]
        return updated
