"""
Manifest management — fetch, cache, diff, and read the content manifest.

The manifest JSON is cached at {cache_dir}/manifest.json.
The agent compares manifest_hash to detect changes and skip unnecessary diffs.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from vant_agent.core.config import AgentConfig

logger = logging.getLogger("vant.sync.manifest")


class ManifestManager:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self._cached: Optional[dict] = None
        self._load_local()

    # ─── Local cache ─────────────────────────────────────────────────────

    def _load_local(self) -> None:
        """Load manifest from disk on startup."""
        path = self.config.manifest_path
        if path.exists():
            try:
                self._cached = json.loads(path.read_text())
                logger.info(f"Loaded local manifest hash={self._cached.get('manifest_hash')}")
            except Exception as e:
                logger.warning(f"Could not read local manifest: {e}")

    def _save_local(self, manifest: dict) -> None:
        path = self.config.manifest_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, default=str))

    @property
    def current(self) -> Optional[dict]:
        """The currently cached manifest (may be None if never synced)."""
        return self._cached

    @property
    def current_hash(self) -> Optional[str]:
        return self._cached.get("manifest_hash") if self._cached else None

    # ─── Fetch & diff ─────────────────────────────────────────────────────

    async def fetch_and_update(self, api) -> bool:
        """
        Fetch manifest from server. Returns True if manifest changed.
        Does NOT trigger downloads — caller handles that.
        """
        manifest = await api.get_manifest()
        if not manifest:
            return False

        new_hash = manifest.get("manifest_hash")
        if new_hash and new_hash == self.current_hash:
            logger.debug(f"Manifest unchanged (hash={new_hash})")
            return False

        logger.info(f"Manifest updated: {self.current_hash} → {new_hash}")
        self._cached = manifest
        self._save_local(manifest)
        return True

    # ─── Media item enumeration ───────────────────────────────────────────

    def all_media_items(self) -> list[dict]:
        """Flat list of all media items referenced in the current manifest."""
        if not self._cached:
            return []
        items = []
        seen_ids: set[str] = set()

        for schedule in self._cached.get("schedules", []):
            playlist = schedule.get("playlist", {})
            for pi in playlist.get("items", []):
                media = pi.get("media", {})
                mid = media.get("id")
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    items.append(media)

        fallback = self._cached.get("fallback_playlist")
        if fallback:
            for pi in fallback.get("items", []):
                media = pi.get("media", {})
                mid = media.get("id")
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    items.append(media)

        return items

    def diff_media(self) -> tuple[list[dict], list[Path]]:
        """
        Compare manifest media against local cache.

        Returns:
            needed  — media items that must be downloaded
            orphans — local files no longer referenced (safe to delete)
        """
        media_dir = self.config.media_dir
        all_items = self.all_media_items()
        referenced_ids = {m["id"] for m in all_items}

        # Find what we need to download
        needed = []
        for media in all_items:
            local = self._local_path(media)
            if not local.exists():
                needed.append(media)

        # Find orphaned local files
        orphans: list[Path] = []
        if media_dir.exists():
            for f in media_dir.iterdir():
                if f.is_file():
                    file_id = f.stem  # filename without extension = media id
                    if file_id not in referenced_ids:
                        orphans.append(f)

        return needed, orphans

    def _local_path(self, media: dict) -> Path:
        """Deterministic local path for a media item."""
        file_type = media.get("file_type", "")
        ext = _ext_for_type(file_type, media.get("name", ""))
        return self.config.media_dir / f"{media['id']}{ext}"

    def local_path_for(self, media_id: str, file_type: str, name: str = "") -> Path:
        ext = _ext_for_type(file_type, name)
        return self.config.media_dir / f"{media_id}{ext}"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _ext_for_type(file_type: str, name: str) -> str:
    """Return a file extension for storage, preferring the original name's ext."""
    if name and "." in name:
        return Path(name).suffix.lower()
    defaults = {
        "image": ".jpg",
        "video": ".mp4",
        "html_template": ".html",
        "pdf": ".pdf",
        "url": ".url",  # stored as a text file with the URL
    }
    return defaults.get(file_type, ".bin")
