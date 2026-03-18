"""
Display Groups CRUD — org-scoped.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import TokenData, get_current_user, require_role
from app.models.models import Display, DisplayGroup
from app.schemas.schemas import (
    DisplayGroupCreate,
    DisplayGroupResponse,
    DisplayGroupUpdate,
)

router = APIRouter(prefix="/api/display-groups", tags=["display-groups"])


@router.get("", response_model=list[DisplayGroupResponse])
async def list_groups(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all display groups for the org with display counts."""
    result = await db.execute(
        select(DisplayGroup)
        .where(DisplayGroup.org_id == current_user.org_id)
        .order_by(DisplayGroup.name)
    )
    groups = result.scalars().all()

    response = []
    for g in groups:
        # Get display counts
        total = (
            await db.execute(
                select(func.count()).where(Display.group_id == g.id)
            )
        ).scalar() or 0
        online = (
            await db.execute(
                select(func.count()).where(
                    Display.group_id == g.id, Display.status == "online"
                )
            )
        ).scalar() or 0

        data = DisplayGroupResponse.model_validate(g)
        data.display_count = total
        data.online_count = online
        response.append(data)

    return response


@router.post("", response_model=DisplayGroupResponse, status_code=201)
async def create_group(
    req: DisplayGroupCreate,
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    group = DisplayGroup(org_id=current_user.org_id, **req.model_dump())
    db.add(group)
    await db.flush()
    return DisplayGroupResponse.model_validate(group)


@router.patch("/{group_id}", response_model=DisplayGroupResponse)
async def update_group(
    group_id: UUID,
    req: DisplayGroupUpdate,
    current_user: TokenData = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DisplayGroup).where(
            DisplayGroup.id == group_id,
            DisplayGroup.org_id == current_user.org_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(group, field, value)
    await db.flush()
    return DisplayGroupResponse.model_validate(group)


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: UUID,
    current_user: TokenData = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DisplayGroup).where(
            DisplayGroup.id == group_id,
            DisplayGroup.org_id == current_user.org_id,
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await db.delete(group)
