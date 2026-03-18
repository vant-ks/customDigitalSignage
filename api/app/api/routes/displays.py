"""
Display CRUD — org-scoped with pagination, filtering, group joins, telemetry.
"""

import math
import secrets
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import TokenData, get_current_user, require_role
from app.models.models import DeviceTelemetry, Display, DisplayGroup
from app.schemas.schemas import (
    DisplayCreate,
    DisplayResponse,
    DisplayUpdate,
    PaginatedResponse,
    TelemetrySnapshot,
)

router = APIRouter(prefix="/api/displays", tags=["displays"])


def _build_display_response(display: Display) -> dict:
    """Convert ORM display to response dict with optional joined data."""
    data = DisplayResponse.model_validate(display).model_dump()

    # Attach group if loaded
    if display.group:
        data["group"] = {
            "id": display.group.id,
            "org_id": display.group.org_id,
            "name": display.group.name,
            "description": display.group.description,
            "color": display.group.color,
            "created_at": display.group.created_at,
            "updated_at": display.group.updated_at,
        }

    # Attach latest telemetry if loaded
    if display.telemetry:
        latest = display.telemetry[0]
        data["latest_telemetry"] = TelemetrySnapshot.model_validate(latest).model_dump()

    return data


@router.get("")
async def list_displays(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    group_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List displays with filtering and pagination."""
    base_q = select(Display).where(Display.org_id == current_user.org_id)

    if status_filter:
        base_q = base_q.where(Display.status == status_filter)
    if group_id:
        base_q = base_q.where(Display.group_id == group_id)
    if search:
        like = f"%{search}%"
        base_q = base_q.where(
            Display.name.ilike(like)
            | Display.location_name.ilike(like)
            | Display.ip_address.ilike(like)
        )
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            base_q = base_q.where(Display.tags.overlap(tag_list))

    # Count
    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch page with joins
    data_q = (
        base_q.options(selectinload(Display.group), selectinload(Display.telemetry))
        .order_by(Display.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(data_q)
    displays = result.scalars().unique().all()

    return PaginatedResponse(
        data=[_build_display_response(d) for d in displays],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


@router.get("/{display_id}")
async def get_display(
    display_id: UUID,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single display with group and latest telemetry."""
    result = await db.execute(
        select(Display)
        .where(Display.id == display_id, Display.org_id == current_user.org_id)
        .options(selectinload(Display.group), selectinload(Display.telemetry))
    )
    display = result.scalar_one_or_none()
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    return _build_display_response(display)


@router.post("", status_code=201)
async def create_display(
    req: DisplayCreate,
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new display. Generates a unique device_token."""
    # Validate group belongs to org
    if req.group_id:
        grp = await db.execute(
            select(DisplayGroup).where(
                DisplayGroup.id == req.group_id,
                DisplayGroup.org_id == current_user.org_id,
            )
        )
        if not grp.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Invalid group_id")

    device_token = f"vdt_{secrets.token_urlsafe(32)}"

    display = Display(
        org_id=current_user.org_id,
        device_token=device_token,
        **req.model_dump(exclude_none=True, exclude={"cache_policy"}),
    )
    if req.cache_policy:
        display.cache_policy = req.cache_policy.model_dump()

    db.add(display)
    await db.flush()
    return DisplayResponse.model_validate(display)


@router.patch("/{display_id}")
async def update_display(
    display_id: UUID,
    req: DisplayUpdate,
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Update display fields."""
    result = await db.execute(
        select(Display).where(
            Display.id == display_id, Display.org_id == current_user.org_id
        )
    )
    display = result.scalar_one_or_none()
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")

    updates = req.model_dump(exclude_none=True, exclude={"cache_policy"})
    for field, value in updates.items():
        setattr(display, field, value)

    if req.cache_policy:
        display.cache_policy = req.cache_policy.model_dump()

    await db.flush()
    return DisplayResponse.model_validate(display)


@router.delete("/{display_id}", status_code=204)
async def delete_display(
    display_id: UUID,
    current_user: TokenData = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a display (admin only)."""
    result = await db.execute(
        select(Display).where(
            Display.id == display_id, Display.org_id == current_user.org_id
        )
    )
    display = result.scalar_one_or_none()
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    await db.delete(display)


@router.get("/{display_id}/telemetry")
async def get_telemetry(
    display_id: UUID,
    hours: int = Query(24, ge=1, le=168),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get telemetry history for a display."""
    from datetime import datetime, timedelta, timezone

    # Verify display belongs to org
    result = await db.execute(
        select(Display.id).where(
            Display.id == display_id, Display.org_id == current_user.org_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Display not found")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(DeviceTelemetry)
        .where(
            DeviceTelemetry.display_id == display_id,
            DeviceTelemetry.recorded_at >= cutoff,
        )
        .order_by(DeviceTelemetry.recorded_at.desc())
        .limit(500)
    )
    rows = result.scalars().all()
    return [TelemetrySnapshot.model_validate(r) for r in rows]


@router.post("/{display_id}/command", status_code=202)
async def send_command(
    display_id: UUID,
    body: dict,
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    """Send a command to a display via WebSocket."""
    from app.websocket.manager import ws_manager

    result = await db.execute(
        select(Display).where(
            Display.id == display_id, Display.org_id == current_user.org_id
        )
    )
    display = result.scalar_one_or_none()
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")

    action = body.get("action")
    if action not in (
        "reboot",
        "restart_agent",
        "take_screenshot",
        "refresh_content",
        "update_config",
    ):
        raise HTTPException(status_code=400, detail="Invalid action")

    await ws_manager.send_to_device(
        display.device_token,
        {
            "type": "command",
            "payload": {"action": action, "params": body.get("params", {})},
        },
    )
    return {"status": "sent", "action": action}
