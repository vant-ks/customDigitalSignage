"""
Agent configuration — loaded from YAML, saved back after registration.

Example config at /etc/vant-agent/config.yaml:
    server_url: https://customdigitalsignage-api-production.up.railway.app
    provisioning_token: vprov_xxx   # only needed before first registration
    device_token: vdt_xxx           # written after registration
    display_id: <uuid>              # written after registration
    cache_dir: /var/cache/vant-agent
    log_level: info
    manifest_interval: 300
    heartbeat_interval: 30
    telemetry_interval: 60
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import yaml  # type: ignore[import-untyped]

DEFAULT_CONFIG_PATH = Path(
    os.environ.get("VANT_CONFIG", "/etc/vant-agent/config.yaml")
)


class AgentConfig:
    def __init__(
        self,
        *,
        server_url: str,
        cache_dir: Path = Path("/var/cache/vant-agent"),
        log_level: str = "info",
        log_file: Optional[str] = None,
        device_token: Optional[str] = None,
        display_id: Optional[str] = None,
        provisioning_token: Optional[str] = None,
        manifest_interval: int = 300,
        heartbeat_interval: int = 30,
        telemetry_interval: int = 60,
        mpv_ipc_socket: str = "/tmp/vant-mpv.sock",
        _path: Path = DEFAULT_CONFIG_PATH,
    ) -> None:
        self.server_url = server_url.rstrip("/")
        self.cache_dir = Path(cache_dir)
        self.log_level = log_level
        self.log_file = log_file
        self.device_token = device_token
        self.display_id = display_id
        self.provisioning_token = provisioning_token
        self.manifest_interval = manifest_interval
        self.heartbeat_interval = heartbeat_interval
        self.telemetry_interval = telemetry_interval
        self.mpv_ipc_socket = mpv_ipc_socket
        self._path = _path

    @classmethod
    def load(cls, path: Path = DEFAULT_CONFIG_PATH) -> "AgentConfig":
        if not path.exists():
            raise FileNotFoundError(f"Config not found: {path}")
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        if "server_url" not in data:
            raise ValueError("server_url is required in config.yaml")
        return cls(
            server_url=data["server_url"],
            cache_dir=Path(data.get("cache_dir", "/var/cache/vant-agent")),
            log_level=data.get("log_level", "info"),
            log_file=data.get("log_file"),
            device_token=data.get("device_token"),
            display_id=data.get("display_id"),
            provisioning_token=data.get("provisioning_token"),
            manifest_interval=int(data.get("manifest_interval", 300)),
            heartbeat_interval=int(data.get("heartbeat_interval", 30)),
            telemetry_interval=int(data.get("telemetry_interval", 60)),
            mpv_ipc_socket=data.get("mpv_ipc_socket", "/tmp/vant-mpv.sock"),
            _path=path,
        )

    def save(self) -> None:
        """Persist device_token and display_id back to config file after registration."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Read existing to preserve all original keys
        existing: dict = {}
        if self._path.exists():
            with open(self._path) as f:
                existing = yaml.safe_load(f) or {}
        existing["device_token"] = self.device_token
        existing["display_id"] = self.display_id
        # Never persist provisioning_token after successful registration
        existing.pop("provisioning_token", None)
        with open(self._path, "w") as f:
            yaml.safe_dump(existing, f, default_flow_style=False)

    @property
    def ws_url(self) -> str:
        """WebSocket URL derived from server_url."""
        url = self.server_url
        if url.startswith("https://"):
            return "wss://" + url[len("https://"):]
        if url.startswith("http://"):
            return "ws://" + url[len("http://"):]
        return "ws://" + url

    @property
    def media_dir(self) -> Path:
        return self.cache_dir / "media"

    @property
    def manifest_path(self) -> Path:
        return self.cache_dir / "manifest.json"
