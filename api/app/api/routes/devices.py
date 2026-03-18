"""
Device endpoints — used by display agents (not dashboard users).
Auth via device_token header or provisioning_token.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import TokenData, get_current_user, require_role
from app.models.models import DeviceTelemetry, Display, ProvisioningToken
from app.schemas.schemas import (
    DeviceHeartbeatRequest,
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    DeviceTelemetryRequest,
    ProvisioningTokenCreate,
    ProvisioningTokenResponse,
)

router = APIRouter(tags=["devices"])
settings = get_settings()


# ─── Helper: authenticate device by token ────────────────────────────────────


async def get_display_by_device_token(
    x_device_token: str = Header(..., alias="X-Device-Token"),
    db: AsyncSession = Depends(get_db),
) -> Display:
    """Dependency: look up display by device token header."""
    result = await db.execute(
        select(Display).where(Display.device_token == x_device_token)
    )
    display = result.scalar_one_or_none()
    if not display:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid device token",
        )
    return display


# ─── Provisioning tokens (dashboard user creates these) ─────────────────────


@router.post(
    "/api/provisioning/tokens",
    response_model=ProvisioningTokenResponse,
    status_code=201,
    tags=["provisioning"],
)
async def create_provisioning_token(
    req: ProvisioningTokenCreate,
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Generate a single-use provisioning token for device setup."""
    token_str = f"vprov_{secrets.token_urlsafe(32)}"
    expires = datetime.now(timezone.utc) + timedelta(hours=req.expires_hours)

    token = ProvisioningToken(
        org_id=current_user.org_id,
        token=token_str,
        display_id=req.display_id,
        hardware_type=req.hardware_type,
        config=req.config,
        expires_at=expires,
    )
    db.add(token)
    await db.flush()
    return ProvisioningTokenResponse.model_validate(token)


# ─── Device registration ────────────────────────────────────────────────────


@router.post(
    "/api/devices/register",
    response_model=DeviceRegisterResponse,
    status_code=201,
    tags=["devices"],
)
async def register_device(
    req: DeviceRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Device uses a provisioning token to register itself.
    Returns a permanent device_token and display config.
    """
    # Find and validate token
    result = await db.execute(
        select(ProvisioningToken).where(
            ProvisioningToken.token == req.provisioning_token
        )
    )
    prov = result.scalar_one_or_none()

    if not prov:
        raise HTTPException(status_code=404, detail="Provisioning token not found")
    if prov.is_used:
        raise HTTPException(status_code=409, detail="Token already used")
    if prov.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Token expired")

    # Mark token as used
    prov.is_used = True
    prov.used_at = datetime.now(timezone.utc)

    # Find or create display
    if prov.display_id:
        result = await db.execute(
            select(Display).where(Display.id == prov.display_id)
        )
        display = result.scalar_one_or_none()
        if not display:
            raise HTTPException(status_code=404, detail="Pre-assigned display not found")
    else:
        # Create new display from provisioning config
        device_token = f"vdt_{secrets.token_urlsafe(32)}"
        display = Display(
            org_id=prov.org_id,
            name=prov.config.get("display_name", f"Display-{secrets.token_hex(4)}"),
            hardware_type=prov.hardware_type or "unknown",
            device_token=device_token,
            status="online",
        )
        db.add(display)
        await db.flush()

    # Update display with device info
    display.status = "online"
    display.last_heartbeat = datetime.now(timezone.utc)
    if req.hostname:
        display.hostname = req.hostname
    if req.ip_address:
        display.ip_address = req.ip_address
    if req.mac_address:
        display.mac_address = req.mac_address
    if req.os_type:
        display.os_type = req.os_type
    if req.agent_version:
        display.agent_version = req.agent_version

    await db.flush()

    return DeviceRegisterResponse(
        device_token=display.device_token,
        display_id=display.id,
        display_name=display.name,
        config={
            **prov.config,
            "cache_policy": display.cache_policy,
            "orientation": display.orientation,
            "resolution_w": display.resolution_w,
            "resolution_h": display.resolution_h,
        },
    )


# ─── Heartbeat ───────────────────────────────────────────────────────────────


@router.post("/api/devices/heartbeat", status_code=200, tags=["devices"])
async def heartbeat(
    req: DeviceHeartbeatRequest,
    display: Display = Depends(get_display_by_device_token),
    db: AsyncSession = Depends(get_db),
):
    """Device heartbeat — update status and last_heartbeat timestamp."""
    display.status = req.status
    display.last_heartbeat = datetime.now(timezone.utc)
    if req.ip_address:
        display.ip_address = req.ip_address
    if req.agent_version:
        display.agent_version = req.agent_version
    await db.flush()

    return {"status": "ok", "display_id": str(display.id)}


# ─── Telemetry ───────────────────────────────────────────────────────────────


@router.post("/api/devices/telemetry", status_code=201, tags=["devices"])
async def report_telemetry(
    req: DeviceTelemetryRequest,
    display: Display = Depends(get_display_by_device_token),
    db: AsyncSession = Depends(get_db),
):
    """Device reports system telemetry."""
    telemetry = DeviceTelemetry(
        display_id=display.id,
        **req.model_dump(exclude_none=True),
    )
    db.add(telemetry)
    await db.flush()

    # Also broadcast to dashboard via WebSocket
    from app.websocket.manager import ws_manager

    await ws_manager.broadcast_to_org(
        str(display.org_id),
        {
            "type": "telemetry",
            "payload": {
                "displayId": str(display.id),
                **req.model_dump(exclude_none=True),
                "recordedAt": datetime.now(timezone.utc).isoformat(),
            },
        },
    )

    return {"status": "recorded"}
