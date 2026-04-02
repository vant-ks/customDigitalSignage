"""
WebSocket command handler — receives commands from the dashboard/server
and dispatches them to the appropriate agent action.

Supported commands (type="command" messages):
  - reboot            : reboot the host
  - restart_agent     : restart this process
  - refresh_content   : force immediate manifest sync
  - take_screenshot   : capture display output, upload
  - update_config     : update config values without restart
  - manifest_update   : immediate manifest re-fetch (pushed by server on schedule change)
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from typing import TYPE_CHECKING, Callable, Coroutine

if TYPE_CHECKING:
    from vant_agent.agent import VantAgent

logger = logging.getLogger("vant.commands")


class CommandHandler:
    def __init__(self, agent: "VantAgent") -> None:
        self._agent = agent
        self._handlers: dict[str, Callable] = {
            "reboot": self._cmd_reboot,
            "restart_agent": self._cmd_restart_agent,
            "refresh_content": self._cmd_refresh_content,
            "take_screenshot": self._cmd_take_screenshot,
            "update_config": self._cmd_update_config,
            "manifest_update": self._cmd_refresh_content,
        }

    async def handle(self, message: dict) -> None:
        """Dispatch an incoming WebSocket message."""
        msg_type = message.get("type")

        if msg_type == "heartbeat_ack":
            logger.debug("Heartbeat acknowledged by server")
            return

        if msg_type == "command":
            command = message.get("command") or message.get("payload", {}).get("command")
            if not command:
                logger.warning(f"Received command message with no command field: {message}")
                return
            handler = self._handlers.get(command)
            if handler:
                logger.info(f"Executing command: {command}")
                try:
                    await handler(message.get("payload") or {})
                except Exception as e:
                    logger.error(f"Command {command} failed: {e}")
            else:
                logger.warning(f"Unknown command: {command}")
            return

        # Unsolicited server pushes (e.g. manifest_update as top-level type)
        if msg_type == "manifest_update":
            await self._cmd_refresh_content({})
            return

        logger.debug(f"Unhandled WS message type: {msg_type}")

    # ─── Command implementations ─────────────────────────────────────────

    async def _cmd_reboot(self, payload: dict) -> None:
        logger.warning("REBOOT command received — rebooting system")
        await asyncio.sleep(1)
        os.system("reboot")

    async def _cmd_restart_agent(self, payload: dict) -> None:
        logger.warning("RESTART_AGENT command received — restarting")
        await asyncio.sleep(1)
        # Replace current process with a fresh one
        os.execv(sys.executable, [sys.executable] + sys.argv)

    async def _cmd_refresh_content(self, payload: dict) -> None:
        """Signal the agent to immediately re-fetch the manifest."""
        logger.info("Refresh content command — triggering immediate sync")
        self._agent.request_sync()

    async def _cmd_take_screenshot(self, payload: dict) -> None:
        """Capture display output and upload to server."""
        import subprocess
        import tempfile
        from pathlib import Path

        output = Path(tempfile.mktemp(suffix=".png"))
        try:
            # Try scrot (Linux X11), then gnome-screenshot, then screencapture (macOS)
            for cmd in (
                ["scrot", "--silent", str(output)],
                ["import", "-window", "root", str(output)],   # ImageMagick
                ["screencapture", "-x", str(output)],          # macOS
            ):
                try:
                    result = subprocess.run(cmd, timeout=10, capture_output=True)
                    if result.returncode == 0 and output.exists():
                        break
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue

            if output.exists():
                # Upload via API — use multipart upload to /api/media/upload or a dedicated endpoint
                # For now, log that screenshot was taken (full upload endpoint TBD in Phase 6)
                logger.info(f"Screenshot captured: {output} ({output.stat().st_size} bytes)")
                output.unlink(missing_ok=True)
            else:
                logger.warning("Screenshot failed — no output file produced")

        except Exception as e:
            logger.error(f"Screenshot error: {e}")
            output.unlink(missing_ok=True)

    async def _cmd_update_config(self, payload: dict) -> None:
        """Apply runtime config changes without full restart."""
        config = self._agent.config
        changed = False

        if "manifest_interval" in payload:
            config.manifest_interval = int(payload["manifest_interval"])
            changed = True
        if "heartbeat_interval" in payload:
            config.heartbeat_interval = int(payload["heartbeat_interval"])
            changed = True
        if "telemetry_interval" in payload:
            config.telemetry_interval = int(payload["telemetry_interval"])
            changed = True
        if "log_level" in payload:
            import logging as _logging
            level = getattr(_logging, payload["log_level"].upper(), None)
            if level:
                _logging.getLogger("vant").setLevel(level)
                config.log_level = payload["log_level"]
                changed = True

        if changed:
            logger.info(f"Config updated via command: {list(payload.keys())}")
