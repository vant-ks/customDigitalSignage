"""
Factory function to instantiate the correct StorageAdapter from a provider_type string.
"""

from .base import StorageAdapter
from .dropbox_adapter import DropboxAdapter
from .gdrive_adapter import GoogleDriveAdapter
from .onedrive_adapter import OneDriveAdapter


def create_adapter(provider_type: str, credentials: dict) -> StorageAdapter:
    match provider_type:
        case "dropbox":
            return DropboxAdapter(credentials)
        case "gdrive":
            return GoogleDriveAdapter(credentials)
        case "onedrive":
            return OneDriveAdapter(credentials)
        case _:
            raise ValueError(f"Unknown provider type: {provider_type!r}")
