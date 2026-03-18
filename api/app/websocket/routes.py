"""
WebSocket endpoint — handles both dashboard user and device agent connections.
"""

import json
import logging

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.core.security import decode_token
from app.models.models import Display
from app.websocket.manager import ws_manager

logger = logging.getLogger("vant.websocket")
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str = Query(default=None),
    device_token: str = Query(default=None),
):
    """
    WebSocket endpoint supporting two auth modes:
    - Dashboard users: ?token=<JWT>
    - Display agents: ?device_token=<device_token>
    """

    if device_token:
        await _handle_device_ws(ws, device_token)
    elif token:
        await _handle_dashboard_ws(ws, token)
    else:
        await ws.close(code=4001, reason="Missing authentication")


async def _handle_dashboard_ws(ws: WebSocket, token: str):
    """Dashboard user WebSocket — JWT authenticated, org-scoped."""
    try:
        payload = decode_token(token)
    except Exception:
        await ws.close(code=4001, reason="Invalid token")
        return

    if payload.get("type") != "access":
        await ws.close(code=4001, reason="Invalid token type")
        return

    org_id = payload.get("org")
    if not org_id:
        await ws.close(code=4001, reason="Missing org in token")
        return

    await ws_manager.connect_dashboard(ws, org_id)

    try:
        while True:
            data = await ws.receive_text()
            try:
                message = json.loads(data)
                await ws_manager.handle_dashboard_message(org_id, message)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from dashboard")
    except WebSocketDisconnect:
        ws_manager.disconnect_dashboard(ws, org_id)
    except Exception as e:
        logger.error(f"Dashboard WS error: {e}")
        ws_manager.disconnect_dashboard(ws, org_id)


async def _handle_device_ws(ws: WebSocket, device_token: str):
    """Display agent WebSocket — device_token authenticated."""
    # Validate device token against DB
    async with async_session_factory() as db:
        result = await db.execute(
            select(Display).where(Display.device_token == device_token)
        )
        display = result.scalar_one_or_none()

    if not display:
        await ws.close(code=4001, reason="Invalid device token")
        return

    org_id = str(display.org_id)
    await ws_manager.connect_device(ws, device_token, org_id)

    try:
        while True:
            data = await ws.receive_text()
            try:
                message = json.loads(data)
                await ws_manager.handle_device_message(device_token, message)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from device {device_token[:12]}")
    except WebSocketDisconnect:
        await ws_manager.disconnect_device(device_token)
    except Exception as e:
        logger.error(f"Device WS error: {e}")
        await ws_manager.disconnect_device(device_token)
