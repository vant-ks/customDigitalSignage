"""
Microsoft OneDrive (Graph API v1.0) storage adapter.
Paths are OneDrive item IDs or Unix-style paths starting with "/".
Graph API @microsoft.graph.downloadUrl is a pre-auth URL — no token needed by recipients.
"""

from typing import Optional

import httpx

from .base import FileEntry, FileListResult, StorageAdapter

GRAPH_API = "https://graph.microsoft.com/v1.0"
MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

_SELECT_FIELDS = "id,name,file,folder,size,lastModifiedDateTime,@microsoft.graph.downloadUrl"


class OneDriveAdapter(StorageAdapter):
    def __init__(self, credentials: dict):
        super().__init__(credentials)
        self._access_token: str = credentials.get("access_token", "")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._access_token}",
            "Content-Type": "application/json",
        }

    def _children_url(self, path: str) -> str:
        if path in ("/", "root", ""):
            return f"{GRAPH_API}/me/drive/root/children"
        if path.startswith("/"):
            return f"{GRAPH_API}/me/drive/root:{path}:/children"
        return f"{GRAPH_API}/me/drive/items/{path}/children"

    def _item_url(self, path: str) -> str:
        if path.startswith("/"):
            return f"{GRAPH_API}/me/drive/root:{path}"
        return f"{GRAPH_API}/me/drive/items/{path}"

    async def list_files(
        self, path: str = "/", cursor: Optional[str] = None
    ) -> FileListResult:
        # cursor is the full @odata.nextLink URL
        url = cursor if cursor else self._children_url(path)
        params = {"$select": _SELECT_FIELDS, "$top": 100}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                url,
                headers=self._headers(),
                params=params if not cursor else {},
            )
        resp.raise_for_status()
        data = resp.json()

        entries = []
        for item in data.get("value", []):
            is_folder = "folder" in item
            file_info = item.get("file", {})
            entries.append(
                FileEntry(
                    name=item["name"],
                    path=item["id"],
                    is_folder=is_folder,
                    size_bytes=item.get("size") if not is_folder else None,
                    modified_at=item.get("lastModifiedDateTime"),
                    mime_type=file_info.get("mimeType") if not is_folder else None,
                )
            )
        next_link = data.get("@odata.nextLink")
        return FileListResult(
            entries=entries, cursor=next_link, has_more=bool(next_link)
        )

    async def get_file_metadata(self, path: str) -> FileEntry:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                self._item_url(path),
                headers=self._headers(),
                params={"$select": "id,name,file,folder,size,lastModifiedDateTime"},
            )
        resp.raise_for_status()
        item = resp.json()
        is_folder = "folder" in item
        return FileEntry(
            name=item["name"],
            path=item["id"],
            is_folder=is_folder,
            size_bytes=item.get("size") if not is_folder else None,
            modified_at=item.get("lastModifiedDateTime"),
            mime_type=item.get("file", {}).get("mimeType") if not is_folder else None,
        )

    async def get_download_url(self, path: str, expires_sec: int = 3600) -> str:
        # @microsoft.graph.downloadUrl is a pre-auth download URL (no token needed).
        # It expires in a few hours; expires_sec is advisory.
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                self._item_url(path),
                headers=self._headers(),
                params={"$select": "@microsoft.graph.downloadUrl"},
            )
        resp.raise_for_status()
        url = resp.json().get("@microsoft.graph.downloadUrl")
        if not url:
            raise ValueError(
                f"OneDrive item {path!r} has no downloadUrl "
                "(may be a folder or unsupported file type)"
            )
        return url

    async def refresh_credentials(
        self, client_id: str, client_secret: str
    ) -> dict:
        refresh_token = self.credentials.get("refresh_token", "")
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                MS_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "scope": "offline_access Files.Read",
                },
            )
        resp.raise_for_status()
        data = resp.json()
        updated = dict(self.credentials)
        updated["access_token"] = data["access_token"]
        if "refresh_token" in data:
            updated["refresh_token"] = data["refresh_token"]
        self.credentials = updated
        self._access_token = updated["access_token"]
        return updated
