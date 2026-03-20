"""
Background media processing pipeline.

- Images: Pillow resize/optimize, extract dimensions, generate 320×180 JPEG thumbnail
- Videos: ffprobe for metadata (no download), ffmpeg for 1-frame thumbnail
- Thumbnails live in /tmp/vant-media/thumbnails/ and are served via GET /api/media/{id}/thumbnail
- Processed URL = original source URL (full transcode deferred to Phase 4/deployment)
"""

import asyncio
import hashlib
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.models.models import MediaAsset
from app.services.storage.crypto import decrypt_credentials
from app.services.storage.factory import create_adapter
from sqlalchemy import select

logger = logging.getLogger("vant.processor")
settings = get_settings()

THUMBNAIL_DIR = Path("/tmp/vant-media/thumbnails")
THUMBNAIL_MAX_W = 320
THUMBNAIL_MAX_H = 180


# ─── Public entry point ──────────────────────────────────────────────────────


async def process_media_asset(
    asset_id: str,
    provider_type: str,
    encrypted_credentials: dict,
) -> None:
    """
    Background task called after a MediaAsset is registered.
    Opens independent DB sessions to avoid holding a connection during I/O.
    """
    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

    # ── Step 1: load asset and mark processing ────────────────────────────
    source_path: Optional[str] = None
    file_type: Optional[str] = None

    async with async_session_factory() as db:
        result = await db.execute(
            select(MediaAsset).where(MediaAsset.id == asset_id)
        )
        asset = result.scalar_one_or_none()
        if not asset:
            logger.error("process_media_asset: asset %s not found", asset_id)
            return
        source_path = asset.source_path
        file_type = asset.file_type
        asset.processing_status = "processing"
        await db.commit()

    # ── Step 2: process ───────────────────────────────────────────────────
    try:
        creds = decrypt_credentials(encrypted_credentials, settings.secret_key)
        adapter = create_adapter(provider_type, creds)
        download_url = await adapter.get_download_url(source_path)

        updates: dict = {}
        if file_type == "image":
            updates = await _process_image(asset_id, download_url)
        elif file_type == "video":
            updates = await _process_video(asset_id, download_url)

        async with async_session_factory() as db:
            result = await db.execute(
                select(MediaAsset).where(MediaAsset.id == asset_id)
            )
            asset = result.scalar_one_or_none()
            if asset:
                for k, v in updates.items():
                    setattr(asset, k, v)
                asset.processing_status = "ready"
                await db.commit()

        logger.info("Asset %s processed successfully", asset_id)

    except Exception as exc:
        logger.exception("Processing failed for asset %s: %s", asset_id, exc)
        async with async_session_factory() as db:
            result = await db.execute(
                select(MediaAsset).where(MediaAsset.id == asset_id)
            )
            asset = result.scalar_one_or_none()
            if asset:
                asset.processing_status = "error"
                asset.processing_error = str(exc)[:500]
                await db.commit()


# ─── Image processing ────────────────────────────────────────────────────────


async def _process_image(asset_id: str, download_url: str) -> dict:
    """Download image, extract dimensions + hash, generate thumbnail."""
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(download_url)
        resp.raise_for_status()
        content = resp.content

    source_hash = hashlib.sha256(content).hexdigest()
    file_size_bytes = len(content)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".img") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with Image.open(tmp_path) as img:
            width, height = img.size
            mime_type = Image.MIME.get(img.format or "", None)

            # Generate thumbnail
            thumb = img.copy()
            thumb.thumbnail((THUMBNAIL_MAX_W, THUMBNAIL_MAX_H), Image.LANCZOS)
            thumb_path = THUMBNAIL_DIR / f"{asset_id}.jpg"
            thumb.convert("RGB").save(str(thumb_path), "JPEG", quality=80, optimize=True)
    finally:
        os.unlink(tmp_path)

    return {
        "source_hash": source_hash,
        "file_size_bytes": file_size_bytes,
        "width": width,
        "height": height,
        "mime_type": mime_type,
        "thumbnail_url": f"/api/media/{asset_id}/thumbnail",
    }


# ─── Video processing ────────────────────────────────────────────────────────


async def _process_video(asset_id: str, download_url: str) -> dict:
    """
    Run ffprobe on the URL to extract metadata without downloading the whole file.
    Then extract one frame as a thumbnail.
    """
    updates: dict = {}

    # ── ffprobe metadata ─────────────────────────────────────────────────
    probe_proc = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        download_url,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, _ = await asyncio.wait_for(probe_proc.communicate(), timeout=30)
    except asyncio.TimeoutError:
        logger.warning("ffprobe timed out for asset %s", asset_id)
        return updates

    if probe_proc.returncode == 0:
        probe = json.loads(stdout.decode())
        for stream in probe.get("streams", []):
            if stream.get("codec_type") == "video":
                updates["width"] = stream.get("width")
                updates["height"] = stream.get("height")
                updates["codec"] = stream.get("codec_name")
                rfr = stream.get("r_frame_rate", "0/1")
                try:
                    num, den = map(int, rfr.split("/"))
                    updates["framerate"] = round(num / den, 3) if den else None
                except (ValueError, ZeroDivisionError):
                    pass
                break
        fmt = probe.get("format", {})
        if fmt.get("duration"):
            updates["duration_sec"] = float(fmt["duration"])
        if fmt.get("size"):
            updates["file_size_bytes"] = int(fmt["size"])

    # ── Thumbnail (1 frame at ~1 s) ──────────────────────────────────────
    thumb_path = THUMBNAIL_DIR / f"{asset_id}.jpg"
    thumb_proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-ss", "1",
        "-i", download_url,
        "-vframes", "1",
        "-vf", f"scale={THUMBNAIL_MAX_W}:-1",
        "-y",
        str(thumb_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        await asyncio.wait_for(thumb_proc.communicate(), timeout=60)
        if thumb_path.exists():
            updates["thumbnail_url"] = f"/api/media/{asset_id}/thumbnail"
    except asyncio.TimeoutError:
        logger.warning("Video thumbnail timed out for asset %s", asset_id)

    return updates
