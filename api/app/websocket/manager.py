"""
WebSocket connection manager.
- Dashboard users connect with JWT, join org-scoped rooms
- Display agents connect with device_token, join device-specific channels
- Supports broadcast to org, send to specific device, and relay between them
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import WebSocket
from sqlalchemy import select

logger = logging.getLogger("vant.websocket")


class ConnectionManager:
    """Manages WebSocket connections for both dashboard users and display agents."""

    def __init__(self):
        # org_id -> set of dashboard WebSocket connections
        self.org_connections: dict[str, set[WebSocket]] = {}
        # device_token -> WebSocket connection
        self.device_connections: dict[str, WebSocket] = {}
        # device_token -> org_id mapping for routing
        self.device_org_map: dict[str, str] = {}

    # ─── Connection lifecycle ────────────────────────────────────────────

    async def connect_dashboard(self, ws: WebSocket, org_id: str):
        """Register a dashboard user's WebSocket connection."""
        await ws.accept()
        if org_id not in self.org_connections:
            self.org_connections[org_id] = set()
        self.org_connections[org_id].add(ws)
        logger.info(f"Dashboard connected: org={org_id}, total={len(self.org_connections[org_id])}")

    async def connect_device(self, ws: WebSocket, device_token: str, org_id: str):
        """Register a display agent's WebSocket connection."""
        await ws.accept()
        self.device_connections[device_token] = ws
        self.device_org_map[device_token] = org_id
        logger.info(f"Device connected: token={device_token[:12]}..., org={org_id}")

        # Notify dashboard that device came online
        await self.broadcast_to_org(org_id, {
            "type": "status_change",
            "payload": {
                "deviceToken": device_token,
                "status": "online",
                "heartbeat": datetime.now(timezone.utc).isoformat(),
            },
        })

    def disconnect_dashboard(self, ws: WebSocket, org_id: str):
        """Remove a dashboard connection."""
        if org_id in self.org_connections:
            self.org_connections[org_id].discard(ws)
            if not self.org_connections[org_id]:
                del self.org_connections[org_id]
        logger.info(f"Dashboard disconnected: org={org_id}")

    async def disconnect_device(self, device_token: str):
        """Remove a device connection and notify dashboard."""
        org_id = self.device_org_map.pop(device_token, None)
        self.device_connections.pop(device_token, None)
        logger.info(f"Device disconnected: token={device_token[:12]}...")

        if org_id:
            await self.broadcast_to_org(org_id, {
                "type": "status_change",
                "payload": {
                    "deviceToken": device_token,
                    "status": "offline",
                    "heartbeat": datetime.now(timezone.utc).isoformat(),
                },
            })

    # ─── Messaging ───────────────────────────────────────────────────────

    async def broadcast_to_org(self, org_id: str, message: dict):
        """Send a message to all dashboard connections in an org."""
        connections = self.org_connections.get(org_id, set())
        dead = set()
        data = json.dumps(message, default=str)

        for ws in connections:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)

        # Clean up dead connections
        for ws in dead:
            connections.discard(ws)

    async def send_to_device(self, device_token: str, message: dict):
        """Send a command/message to a specific display agent."""
        ws = self.device_connections.get(device_token)
        if ws:
            try:
                await ws.send_text(json.dumps(message, default=str))
                return True
            except Exception:
                await self.disconnect_device(device_token)
        return False

    async def handle_device_message(self, device_token: str, message: dict):
        """
        Process an incoming message from a display agent.
        Routes telemetry and status changes to the org's dashboard connections.
        """
        org_id = self.device_org_map.get(device_token)
        if not org_id:
            return

        msg_type = message.get("type")

        if msg_type == "heartbeat":
            # ACK back to device
            ws = self.device_connections.get(device_token)
            if ws:
                try:
                    await ws.send_text(json.dumps({
                        "type": "heartbeat_ack",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }))
                except Exception:
                    pass

        elif msg_type in ("telemetry", "status_change", "screenshot", "sync_status"):
            # Forward to dashboard
            await self.broadcast_to_org(org_id, message)

    async def handle_dashboard_message(self, org_id: str, message: dict):
        """
        Process an incoming message from a dashboard user.
        Routes commands to target devices.
        """
        msg_type = message.get("type")

        if msg_type == "command":
            device_token = message.get("deviceToken")
            if device_token:
                await self.send_to_device(device_token, message)

        elif msg_type == "heartbeat":
            # Dashboard heartbeat — no action needed
            pass

    # ─── Stats ───────────────────────────────────────────────────────────

    @property
    def stats(self) -> dict:
        return {
            "dashboard_orgs": len(self.org_connections),
            "dashboard_connections": sum(
                len(c) for c in self.org_connections.values()
            ),
            "device_connections": len(self.device_connections),
        }


# Singleton instance
ws_manager = ConnectionManager()
