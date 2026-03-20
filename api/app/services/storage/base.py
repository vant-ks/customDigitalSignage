"""
Abstract storage adapter interface.
All cloud storage implementations must subclass StorageAdapter.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FileEntry:
    name: str
    path: str               # opaque identifier — path for Dropbox, item ID for GDrive/OneDrive
    is_folder: bool
    size_bytes: Optional[int] = None
    modified_at: Optional[str] = None
    mime_type: Optional[str] = None
    thumbnail_url: Optional[str] = None


@dataclass
class FileListResult:
    entries: list[FileEntry] = field(default_factory=list)
    cursor: Optional[str] = None   # opaque pagination token
    has_more: bool = False


class StorageAdapter(ABC):
    def __init__(self, credentials: dict):
        self.credentials = credentials

    @abstractmethod
    async def list_files(self, path: str = "/", cursor: Optional[str] = None) -> FileListResult:
        """List files and folders at the given path/folder-id."""
        ...

    @abstractmethod
    async def get_file_metadata(self, path: str) -> FileEntry:
        """Return metadata for a single file or folder."""
        ...

    @abstractmethod
    async def get_download_url(self, path: str, expires_sec: int = 3600) -> str:
        """Return a time-limited direct download URL for the file."""
        ...

    @abstractmethod
    async def refresh_credentials(self, client_id: str, client_secret: str) -> dict:
        """Refresh OAuth tokens if expired. Returns updated credentials dict."""
        ...
