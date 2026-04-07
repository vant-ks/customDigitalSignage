"""
VantAgent — main orchestrator.

Runs five concurrent asyncio tasks:
  1. heartbeat_loop    — POST /api/devices/heartbeat every 30s
  2. sync_loop         — fetch manifest + download media every 5min (configurable)
  3. telemetry_loop    — POST /api/devices/telemetry every 60s
  4. ws_loop           — persistent WebSocket connection with auto-reconnect
  5. playback_loop     — continuously resolves and plays the current schedule

Usage:
    asyncio.run(VantAgent.run(config_path))
"""

from __future__ import annotations

import asyncio
import json
import logging
import platform
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from vant_agent import __version__
from vant_agent.commands.handler import CommandHandler
from vant_agent.core.api_client import ApiClient
from vant_agent.core.config import AgentConfig, DEFAULT_CONFIG_PATH
from vant_agent.playback.player import Player
from vant_agent.playback.scheduler import resolve_active_playlist
from vant_agent.sync.downloader import Downloader
from vant_agent.sync.manifest import ManifestManager
from vant_agent.telemetry import collector as telemetry_collector

logger = logging.getLogger("vant.agent")

WS_RECONNECT_BACKOFF = [5, 10, 30, 60, 120]  # seconds


class VantAgent:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.api = ApiClient(config)
        self.manifest = ManifestManager(config)
        self.downloader = Downloader(config, self.manifest)
        self.player = Player(config)
        self.commands = CommandHandler(self)

        # Shared state
        self._playback_state: dict = {"status": "idle"}
        self._sync_event = asyncio.Event()   # set to trigger immediate sync
        self._shutdown = asyncio.Event()

    # ─── Entry points ─────────────────────────────────────────────────────

    @classmethod
    async def run(cls, config_path: Optional[Path] = None) -> None:
        path = config_path or DEFAULT_CONFIG_PATH
        config = AgentConfig.load(path)
        _setup_logging(config)

        logger.info(f"VANT Agent v{__version__} starting on {platform.node()}")

        agent = cls(config)

        # First-boot registration if needed
        if not config.device_token:
            if not config.provisioning_token:
                logger.error(
                    "No device_token and no provisioning_token in config. "
                    "Run: vant-agent register --token vprov_xxx"
                )
                sys.exit(1)
            await agent._register(config.provisioning_token)

        # Ensure cache dirs exist
        config.media_dir.mkdir(parents=True, exist_ok=True)

        await agent._start()

    @classmethod
    async def provision(cls, config_path: Optional[Path], token: str) -> None:
        path = config_path or DEFAULT_CONFIG_PATH
        config = AgentConfig.load(path)
        _setup_logging(config)
        agent = cls(config)
        await agent._register(token)
        print(f"Registration successful. display_id={config.display_id}")

    # ─── Registration ─────────────────────────────────────────────────────

    async def _register(self, provisioning_token: str) -> None:
        logger.info("Registering device with provisioning token...")
        info = {
            "hostname": socket.gethostname(),
            "ip_address": _local_ip(),
            "os_type": platform.system().lower(),
            "agent_version": __version__,
        }
        result = await self.api.register(provisioning_token, **info)
        self.config.device_token = result["device_token"]
        self.config.display_id = result["display_id"]
        self.config.save()
        self.api.config = self.config  # refresh reference
        logger.info(f"Registered: display_id={self.config.display_id}")

    # ─── Main task runner ─────────────────────────────────────────────────

    async def _start(self) -> None:
        tasks = [
            asyncio.create_task(self._heartbeat_loop(), name="heartbeat"),
            asyncio.create_task(self._sync_loop(), name="sync"),
            asyncio.create_task(self._telemetry_loop(), name="telemetry"),
            asyncio.create_task(self._ws_loop(), name="websocket"),
            asyncio.create_task(self._playback_loop(), name="playback"),
        ]
        try:
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)
            for t in done:
                if t.exception():
                    logger.error(f"Task {t.get_name()} crashed: {t.exception()}")
        except asyncio.CancelledError:
            pass
        finally:
            for t in tasks:
                t.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            await self.player.shutdown()
            logger.info("Agent stopped")

    # ─── Heartbeat loop ───────────────────────────────────────────────────

    async def _heartbeat_loop(self) -> None:
        while not self._shutdown.is_set():
            try:
                await self.api.heartbeat(
                    status=self._playback_state.get("status", "online"),
                    ip_address=_local_ip(),
                    agent_version=__version__,
                )
                logger.debug("Heartbeat sent")
            except Exception as e:
                logger.debug(f"Heartbeat error: {e}")
            await asyncio.sleep(self.config.heartbeat_interval)

    # ─── Sync loop ────────────────────────────────────────────────────────

    async def _sync_loop(self) -> None:
        # Trigger an immediate sync on start
        self._sync_event.set()

        while not self._shutdown.is_set():
            try:
                await asyncio.wait_for(
                    self._sync_event.wait(),
                    timeout=float(self.config.manifest_interval),
                )
            except asyncio.TimeoutError:
                pass
            self._sync_event.clear()

            await self._do_sync()

    async def _do_sync(self) -> None:
        logger.info("Starting content sync")
        try:
            changed = await self.manifest.fetch_and_update(self.api)
        except Exception as e:
            logger.warning(f"Manifest fetch error: {e}")
            changed = False

        try:
            downloaded, deleted = await self.downloader.sync(self.api)
        except Exception as e:
            logger.warning(f"Download error: {e}")
            downloaded, deleted = 0, 0

        stats = self.downloader.cache_stats()
        await self.api.report_sync_status({
            "manifest_hash": self.manifest.current_hash,
            "cache_used_gb": stats.get("used_gb"),
            "cached_item_count": stats.get("item_count"),
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "sync_status": "ok",
        })
        logger.info(f"Sync done: manifest_changed={changed}, downloaded={downloaded}, deleted={deleted}")

    def request_sync(self) -> None:
        """Signal the sync loop to run immediately (used by command handler)."""
        self._sync_event.set()

    # ─── Telemetry loop ───────────────────────────────────────────────────

    async def _telemetry_loop(self) -> None:
        while not self._shutdown.is_set():
            await asyncio.sleep(self.config.telemetry_interval)
            try:
                stats = self.downloader.cache_stats()
                data = telemetry_collector.collect(
                    cache_stats=stats,
                    playback_state=self._playback_state,
                )
                await self.api.report_telemetry(data)
                logger.debug(f"Telemetry: cpu={data.get('cpu_percent')}% mem={data.get('memory_percent')}%")
            except Exception as e:
                logger.debug(f"Telemetry error: {e}")

    # ─── WebSocket loop ───────────────────────────────────────────────────

    async def _ws_loop(self) -> None:
        import websockets  # type: ignore[import]

        ws_url = f"{self.config.ws_url}/ws?device_token={self.config.device_token}"
        backoff_idx = 0

        while not self._shutdown.is_set():
            try:
                logger.info(f"Connecting to WebSocket: {self.config.ws_url}/ws")
                async with websockets.connect(
                    ws_url,
                    ping_interval=30,
                    ping_timeout=10,
                    close_timeout=5,
                ) as ws:
                    backoff_idx = 0  # Reset on successful connection
                    logger.info("WebSocket connected")
                    self._playback_state["status"] = "online"

                    async for raw in ws:
                        try:
                            message = json.loads(raw)
                            await self.commands.handle(message)
                        except json.JSONDecodeError:
                            logger.debug(f"Invalid WS JSON: {raw[:100]}")
                        except Exception as e:
                            logger.warning(f"WS message handling error: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                backoff = WS_RECONNECT_BACKOFF[min(backoff_idx, len(WS_RECONNECT_BACKOFF) - 1)]
                backoff_idx += 1
                logger.warning(f"WebSocket disconnected ({e}), reconnecting in {backoff}s")
                self._playback_state["status"] = "online"  # stay "online" — heartbeats continue
                await asyncio.sleep(backoff)

    # ─── Playback loop ────────────────────────────────────────────────────

    async def _playback_loop(self) -> None:
        """
        Continuously resolves the active playlist and plays it.
        Playlist position is tracked; we restart from beginning when the playlist changes.
        """
        current_playlist_id: Optional[str] = None
        item_index = 0

        while not self._shutdown.is_set():
            manifest = self.manifest.current
            now = datetime.now(timezone.utc)
            playlist = resolve_active_playlist(manifest, now)

            if not playlist:
                self._playback_state = {"status": "idle"}
                await self.player.show_holding_screen()
                await asyncio.sleep(10)
                continue

            pid = playlist.get("id")
            items = playlist.get("items", [])
            if not items:
                await asyncio.sleep(5)
                continue

            # Restart from 0 when playlist changes
            if pid != current_playlist_id:
                logger.info(f"Switching to playlist: {playlist.get('name')} ({pid})")
                current_playlist_id = pid
                item_index = 0

            item = items[item_index % len(items)]
            media = item.get("media", {})
            duration_sec: int = max(1, item.get("duration_sec", 10))

            self._playback_state = {
                "status": "playing",
                "playlist_id": pid,
                "media_id": media.get("id"),
            }

            try:
                await self.player.play_item(item, self.config.media_dir)
            except Exception as e:
                logger.warning(f"play_item error: {e}")

            # Wait for item duration, but wake early if sync signals a change
            try:
                await asyncio.wait_for(
                    self._wait_for_sync_or_sleep(duration_sec),
                    timeout=float(duration_sec) + 1,
                )
            except asyncio.TimeoutError:
                pass

            item_index += 1

    async def _wait_for_sync_or_sleep(self, seconds: float) -> None:
        """Sleep for `seconds` unless a sync event interrupts."""
        sync_task = asyncio.create_task(self._sync_event.wait())
        sleep_task = asyncio.create_task(asyncio.sleep(seconds))
        done, pending = await asyncio.wait(
            {sync_task, sleep_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for t in pending:
            t.cancel()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _local_ip() -> Optional[str]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return None


def _setup_logging(config: AgentConfig) -> None:
    level = getattr(logging, config.log_level.upper(), logging.INFO)
    handlers: list[logging.Handler] = [logging.StreamHandler()]

    if config.log_file:
        handlers.append(logging.FileHandler(config.log_file))

    logging.basicConfig(
        level=level,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        handlers=handlers,
        force=True,
    )
    logging.getLogger("vant").setLevel(level)
    # Quiet down noisy library loggers
    logging.getLogger("websockets").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
