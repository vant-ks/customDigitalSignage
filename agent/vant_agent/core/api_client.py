"""
HTTP API client for the VANT Signage server.
Authenticates device requests via X-Device-Token header.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx  # type: ignore[import]

from vant_agent.core.config import AgentConfig

logger = logging.getLogger("vant.api")

TIMEOUT = httpx.Timeout(30.0, connect=10.0)
AGENT_VERSION = "0.1.0"


class ApiClient:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config

    def _headers(self) -> dict:
        headers = {"User-Agent": f"vant-agent/{AGENT_VERSION}"}
        if self.config.device_token:
            headers["X-Device-Token"] = self.config.device_token
        return headers

    async def register(self, provisioning_token: str, **device_info: Any) -> dict:
        """POST /api/devices/register — first-boot registration."""
        payload = {"provisioning_token": provisioning_token, **device_info}
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(
                f"{self.config.server_url}/api/devices/register",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def heartbeat(self, status: str = "online", **extra: Any) -> Optional[dict]:
        """POST /api/devices/heartbeat."""
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, headers=self._headers()) as client:
                resp = await client.post(
                    f"{self.config.server_url}/api/devices/heartbeat",
                    json={"status": status, **extra},
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")
            return None

    async def get_manifest(self) -> Optional[dict]:
        """GET /api/displays/{id}/manifest — fetch content manifest."""
        if not self.config.display_id:
            return None
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, headers=self._headers()) as client:
                resp = await client.get(
                    f"{self.config.server_url}/api/displays/{self.config.display_id}/manifest",
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning(f"Manifest fetch failed: {e}")
            return None

    async def report_telemetry(self, payload: dict) -> None:
        """POST /api/devices/telemetry."""
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, headers=self._headers()) as client:
                resp = await client.post(
                    f"{self.config.server_url}/api/devices/telemetry",
                    json=payload,
                )
                resp.raise_for_status()
        except Exception as e:
            logger.debug(f"Telemetry report failed: {e}")

    async def report_sync_status(self, payload: dict) -> None:
        """POST /api/devices/{id}/sync-status."""
        if not self.config.display_id:
            return
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, headers=self._headers()) as client:
                resp = await client.post(
                    f"{self.config.server_url}/api/devices/{self.config.display_id}/sync-status",
                    json=payload,
                )
                resp.raise_for_status()
        except Exception as e:
            logger.debug(f"Sync status report failed: {e}")

    async def download_file(self, url: str, dest_path) -> bool:
        """
        Stream-download a file to dest_path.
        Passes device token if URL is on our own server.
        Returns True on success.
        """
        import aiofiles  # type: ignore[import-untyped]

        headers = {}
        if url.startswith(self.config.server_url):
            headers = self._headers()

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
                async with client.stream("GET", url, headers=headers, follow_redirects=True) as resp:
                    resp.raise_for_status()
                    import pathlib
                    pathlib.Path(dest_path).parent.mkdir(parents=True, exist_ok=True)
                    async with aiofiles.open(dest_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=65536):
                            await f.write(chunk)
            return True
        except Exception as e:
            logger.warning(f"Download failed {url}: {e}")
            return False
