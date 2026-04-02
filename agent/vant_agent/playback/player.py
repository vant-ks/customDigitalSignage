"""
Playback engine — controls mpv (images/videos) and Chromium (URLs/HTML templates).

mpv is launched in idle mode and controlled via the IPC Unix socket.
Chromium is launched in kiosk mode for web content.

Playback loop:
  - Resolve active playlist from local manifest
  - For each item, play using the appropriate renderer
  - After duration_sec, advance to next item
  - If playlist changes (schedule change or manifest update), restart from current item
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Optional

from vant_agent.core.config import AgentConfig
from vant_agent.playback.scheduler import resolve_active_playlist
from vant_agent.sync.manifest import ManifestManager

logger = logging.getLogger("vant.playback.player")

MPV_STARTUP_WAIT = 3.0    # seconds to wait for mpv socket after launch
IPC_CONNECT_RETRIES = 10


def _mpv_bin() -> str:
    candidates = ["mpv", "/usr/bin/mpv", "/usr/local/bin/mpv"]
    for c in candidates:
        if os.path.exists(c) or os.path.isabs(c) is False:
            return c
    return "mpv"


def _chromium_bin() -> str:
    candidates = [
        "chromium-browser",
        "chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for c in candidates:
        if Path(c).exists() if c.startswith("/") else True:
            return c
    return "chromium-browser"


class Player:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self._mpv_proc: Optional[asyncio.subprocess.Process] = None
        self._chromium_proc: Optional[asyncio.subprocess.Process] = None
        self._mpv_socket = config.mpv_ipc_socket

    # ─── MPV lifecycle ────────────────────────────────────────────────────

    async def ensure_mpv(self) -> bool:
        """Start mpv if not running. Returns True if ready."""
        if self._mpv_proc and self._mpv_proc.returncode is None:
            return True  # already running

        logger.info("Starting mpv")
        # Remove stale socket
        try:
            Path(self._mpv_socket).unlink(missing_ok=True)
        except OSError:
            pass

        try:
            self._mpv_proc = await asyncio.create_subprocess_exec(
                _mpv_bin(),
                "--idle=yes",
                "--no-terminal",
                "--really-quiet",
                "--no-config",
                "--loop-playlist=no",
                f"--input-ipc-server={self._mpv_socket}",
                # Kiosk / fullscreen
                "--fs",
                "--no-border",
                "--no-osc",
                # Hardware accel (best-effort — falls back gracefully)
                "--hwdec=auto-safe",
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except FileNotFoundError:
            logger.error("mpv not found — install with: apt-get install mpv")
            return False
        except Exception as e:
            logger.error(f"Failed to start mpv: {e}")
            return False

        # Wait for socket to appear
        for _ in range(IPC_CONNECT_RETRIES):
            await asyncio.sleep(MPV_STARTUP_WAIT / IPC_CONNECT_RETRIES)
            if Path(self._mpv_socket).exists():
                logger.info("mpv ready")
                return True

        logger.warning("mpv started but IPC socket not found yet")
        return Path(self._mpv_socket).exists()

    async def stop_mpv(self) -> None:
        await self._mpv_command({"command": ["stop"]})
        await asyncio.sleep(0.5)

    async def kill_mpv(self) -> None:
        if self._mpv_proc and self._mpv_proc.returncode is None:
            self._mpv_proc.terminate()
            try:
                await asyncio.wait_for(self._mpv_proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                self._mpv_proc.kill()
        self._mpv_proc = None
        try:
            Path(self._mpv_socket).unlink(missing_ok=True)
        except OSError:
            pass

    # ─── MPV IPC ──────────────────────────────────────────────────────────

    async def _mpv_command(self, cmd: dict) -> Optional[dict]:
        sock = self._mpv_socket
        if not Path(sock).exists():
            return None
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_unix_connection(sock), timeout=5.0
            )
            writer.write(json.dumps(cmd).encode() + b"\n")
            await writer.drain()
            # Read one response line
            line = await asyncio.wait_for(reader.readline(), timeout=5.0)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            if line:
                return json.loads(line)
        except Exception as e:
            logger.debug(f"mpv IPC error: {e}")
        return None

    async def mpv_loadfile(self, path: str, image_duration: Optional[int] = None) -> None:
        """Load a file into mpv, replacing current content."""
        options = ""
        if image_duration is not None:
            options = f"image-display-duration={image_duration}"

        cmd: dict = {"command": ["loadfile", path, "replace"]}
        if options:
            cmd = {"command": ["loadfile", path, "replace", 0, options]}
        await self._mpv_command(cmd)

    # ─── Chromium ─────────────────────────────────────────────────────────

    async def kill_chromium(self) -> None:
        if self._chromium_proc and self._chromium_proc.returncode is None:
            self._chromium_proc.terminate()
            try:
                await asyncio.wait_for(self._chromium_proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                self._chromium_proc.kill()
        self._chromium_proc = None

    async def launch_chromium(self, url: str) -> None:
        await self.kill_chromium()
        flags = [
            "--kiosk",
            "--noerrdialogs",
            "--disable-infobars",
            "--disable-restore-session-state",
            "--disable-session-crashed-bubble",
            "--autoplay-policy=no-user-gesture-required",
            "--disable-features=TranslateUI",
            "--check-for-update-interval=604800",
        ]
        if platform.system() == "Linux":
            flags += ["--no-sandbox", "--disable-gpu-sandbox"]

        try:
            self._chromium_proc = await asyncio.create_subprocess_exec(
                _chromium_bin(), *flags, url,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            logger.info(f"Chromium launched: {url[:80]}")
        except FileNotFoundError:
            logger.error("Chromium not found — install with: apt-get install chromium-browser")
        except Exception as e:
            logger.error(f"Failed to launch Chromium: {e}")

    # ─── High-level play item ─────────────────────────────────────────────

    async def play_item(self, item: dict, media_dir: Path) -> None:
        """
        Display a playlist item. Handles routing between mpv and Chromium.
        Does NOT wait for duration — caller sleeps for item.duration_sec.
        """
        media = item.get("media", {})
        file_type = media.get("file_type", "")
        media_id = media.get("id", "")
        media_name = media.get("name", "")
        duration_sec: int = item.get("duration_sec", 10)

        if file_type in ("image", "video"):
            # Find local cached file
            local = _find_local(media_id, media_dir)
            if not local:
                logger.warning(f"Media not cached: {media_id} ({media_name}), skipping")
                return
            await self.kill_chromium()
            if not await self.ensure_mpv():
                return
            img_dur = duration_sec if file_type == "image" else None
            await self.mpv_loadfile(str(local), image_duration=img_dur)
            logger.debug(f"Playing {file_type}: {local.name}")

        elif file_type == "url":
            url_file = _find_local(media_id, media_dir)
            if url_file and url_file.exists():
                url = url_file.read_text().strip()
            else:
                url = media.get("source_url", "about:blank")
            await self.kill_mpv()
            await self.launch_chromium(url)

        elif file_type == "html_template":
            local = _find_local(media_id, media_dir)
            if not local:
                logger.warning(f"HTML template not cached: {media_id}, skipping")
                return
            await self.kill_mpv()
            await self.launch_chromium(f"file://{local}")

        elif file_type == "pdf":
            local = _find_local(media_id, media_dir)
            if not local:
                return
            # Chromium handles PDF display
            await self.kill_mpv()
            await self.launch_chromium(f"file://{local}")

        else:
            logger.warning(f"Unknown file_type={file_type} for media {media_id}")

    async def show_holding_screen(self) -> None:
        """Black idle screen while no content is scheduled."""
        await self.kill_chromium()
        if await self.ensure_mpv():
            await self._mpv_command({"command": ["stop"]})

    async def shutdown(self) -> None:
        await self.kill_chromium()
        await self.kill_mpv()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _find_local(media_id: str, media_dir: Path) -> Optional[Path]:
    """Find any local file matching media_id (any extension)."""
    if not media_dir.exists():
        return None
    for f in media_dir.iterdir():
        if f.stem == media_id:
            return f
    return None
