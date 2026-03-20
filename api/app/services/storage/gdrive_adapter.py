"""
Google Drive API v3 storage adapter.
Paths are GDrive item IDs (not Unix paths). Root is "root".
Download URLs embed the short-lived access token as a query param — acceptable
for Phase 2 in controlled environments. Phase 5 should proxy through our API.
"""

from typing import Optional

import httpx

from .base import FileEntry, FileListResult, StorageAdapter

GDRIVE_API = "https://www.googleapis.com/drive/v3"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
FOLDER_MIME = "application/vnd.google-apps.folder"

# Google Workspace doc types are not downloadable as-is; skip them in listings
_SKIP_MIMES = {
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.form",
}


class GoogleDriveAdapter(StorageAdapter):
    def __init__(self, credentials: dict):
        super().__init__(credentials)
        self._access_token: str = credentials.get("access_token", "")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._access_token}"}

    async def list_files(
        self, path: str = "/", cursor: Optional[str] = None
    ) -> FileListResult:
        folder_id = "root" if path in ("/", "", "root") else path
        params: dict = {
            "q": f"'{folder_id}' in parents and trashed = false",
            "fields": "nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink)",
            "pageSize": 100,
        }
        if cursor:
            params["pageToken"] = cursor

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GDRIVE_API}/files", headers=self._headers(), params=params
            )
        resp.raise_for_status()
        data = resp.json()

        entries = []
        for item in data.get("files", []):
            mime = item.get("mimeType", "")
            if mime in _SKIP_MIMES:
                continue
            is_folder = mime == FOLDER_MIME
            entries.append(
                FileEntry(
                    name=item["name"],
                    path=item["id"],
                    is_folder=is_folder,
                    size_bytes=(
                        int(item["size"])
                        if not is_folder and item.get("size")
                        else None
                    ),
                    modified_at=item.get("modifiedTime"),
                    mime_type=mime if not is_folder else None,
                    thumbnail_url=item.get("thumbnailLink"),
                )
            )
        return FileListResult(
            entries=entries,
            cursor=data.get("nextPageToken"),
            has_more=bool(data.get("nextPageToken")),
        )

    async def get_file_metadata(self, path: str) -> FileEntry:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GDRIVE_API}/files/{path}",
                headers=self._headers(),
                params={
                    "fields": "id,name,mimeType,size,modifiedTime,thumbnailLink"
                },
            )
        resp.raise_for_status()
        item = resp.json()
        is_folder = item["mimeType"] == FOLDER_MIME
        return FileEntry(
            name=item["name"],
            path=item["id"],
            is_folder=is_folder,
            size_bytes=(
                int(item["size"]) if not is_folder and item.get("size") else None
            ),
            modified_at=item.get("modifiedTime"),
            mime_type=item.get("mimeType") if not is_folder else None,
            thumbnail_url=item.get("thumbnailLink"),
        )

    async def get_download_url(self, path: str, expires_sec: int = 3600) -> str:
        # GDrive doesn't issue pre-signed URLs without a service account.
        # Embed the access token in the URL (token lifetime ~1hr from Google).
        # The display agent must treat this URL as opaque and download promptly.
        return (
            f"{GDRIVE_API}/files/{path}"
            f"?alt=media&access_token={self._access_token}"
        )

    async def refresh_credentials(
        self, client_id: str, client_secret: str
    ) -> dict:
        refresh_token = self.credentials.get("refresh_token", "")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
            )
        resp.raise_for_status()
        data = resp.json()
        updated = dict(self.credentials)
        updated["access_token"] = data["access_token"]
        # Google doesn't return a new refresh_token on standard refresh
        self.credentials = updated
        self._access_token = updated["access_token"]
        return updated
