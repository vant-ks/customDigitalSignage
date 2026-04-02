"""
Media downloader — downloads, verifies (SHA-256), and stores media items.
Enforces cache size limit with LRU eviction.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from pathlib import Path
from typing import Optional

from vant_agent.core.config import AgentConfig
from vant_agent.sync.manifest import ManifestManager, _ext_for_type

logger = logging.getLogger("vant.sync.downloader")

MAX_RETRIES = 3
RETRY_BACKOFF = [5, 15, 60]  # seconds between retries


class Downloader:
    def __init__(self, config: AgentConfig, manifest: ManifestManager) -> None:
        self.config = config
        self.manifest = manifest
        self._lock = asyncio.Lock()

    # ─── Public API ────────────────────────────────────────────────────────

    async def sync(self, api) -> tuple[int, int]:
        """
        Diff the manifest against local cache, download what's missing,
        delete orphans, and enforce cache size limit.

        Returns: (downloaded_count, deleted_count)
        """
        async with self._lock:
            needed, orphans = self.manifest.diff_media()

            if not needed and not orphans:
                logger.debug("Cache already in sync")
                return 0, 0

            logger.info(f"Sync: {len(needed)} to download, {len(orphans)} orphans to remove")

            # Delete orphaned files first to free space
            deleted = 0
            for path in orphans:
                try:
                    path.unlink()
                    deleted += 1
                    logger.debug(f"Deleted orphan: {path.name}")
                except OSError as e:
                    logger.warning(f"Could not delete {path}: {e}")

            # Download missing items
            downloaded = 0
            for media in needed:
                success = await self._download_with_retry(api, media)
                if success:
                    downloaded += 1

            # Enforce cache size limit
            cache_policy = (self.manifest.current or {}).get("cache_policy", {})
            max_gb = float(cache_policy.get("max_gb", 10))
            await self._enforce_cache_limit(max_gb)

            logger.info(f"Sync complete: {downloaded} downloaded, {deleted} deleted")
            return downloaded, deleted

    # ─── Download + verify ──────────────────────────────────────────────────

    async def _download_with_retry(self, api, media: dict) -> bool:
        url = media.get("source_url")
        if not url:
            logger.warning(f"Media {media.get('id')} has no source_url, skipping")
            return False

        dest = self.manifest.local_path_for(
            media["id"], media.get("file_type", ""), media.get("name", "")
        )

        # Handle URL-type items — store the URL as a text file
        if media.get("file_type") == "url":
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(url)
            return True

        for attempt in range(MAX_RETRIES):
            if attempt > 0:
                backoff = RETRY_BACKOFF[min(attempt - 1, len(RETRY_BACKOFF) - 1)]
                logger.debug(f"Retry {attempt}/{MAX_RETRIES} for {media['id']} in {backoff}s")
                await asyncio.sleep(backoff)

            try:
                ok = await api.download_file(url, dest)
                if not ok:
                    continue

                # Verify hash if provided
                expected_hash = media.get("source_hash")
                if expected_hash and not _verify_hash(dest, expected_hash):
                    logger.warning(f"Hash mismatch for {media['id']}, deleting")
                    dest.unlink(missing_ok=True)
                    continue

                logger.info(f"Downloaded: {dest.name} ({_human_size(dest.stat().st_size)})")
                return True

            except Exception as e:
                logger.warning(f"Download error {media['id']} attempt {attempt + 1}: {e}")

        logger.error(f"Failed to download media {media['id']} after {MAX_RETRIES} attempts")
        return False

    # ─── Cache size management ──────────────────────────────────────────────

    async def _enforce_cache_limit(self, max_gb: float) -> None:
        media_dir = self.config.media_dir
        if not media_dir.exists():
            return

        max_bytes = int(max_gb * 1024 ** 3)
        files = sorted(
            [(f, f.stat()) for f in media_dir.iterdir() if f.is_file()],
            key=lambda x: x[1].st_atime,  # LRU: oldest access first
        )

        total = sum(s.st_size for _, s in files)
        if total <= max_bytes:
            return

        logger.info(f"Cache over limit ({_human_size(total)} / {_human_size(max_bytes)}), evicting LRU")
        for path, stat in files:
            if total <= max_bytes:
                break
            try:
                path.unlink()
                total -= stat.st_size
                logger.debug(f"Evicted: {path.name}")
            except OSError:
                pass

    def cache_stats(self) -> dict:
        media_dir = self.config.media_dir
        if not media_dir.exists():
            return {"used_bytes": 0, "item_count": 0}
        files = list(media_dir.iterdir())
        files = [f for f in files if f.is_file()]
        total = sum(f.stat().st_size for f in files)
        return {
            "used_bytes": total,
            "used_gb": round(total / 1024 ** 3, 3),
            "item_count": len(files),
        }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _verify_hash(path: Path, expected: str) -> bool:
    """Verify SHA-256 hash. expected may be 'sha256:<hex>' or raw hex."""
    if expected.startswith("sha256:"):
        expected = expected[7:]
    try:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest() == expected
    except OSError:
        return False


def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"
