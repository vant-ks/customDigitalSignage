"""
Audit log read endpoints.

GET /api/audit   — paginated, filterable by entity_type / user_id / date range
"""

import math
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import TokenData, require_role
from app.models.models import AuditLog
from app.schemas.schemas import AuditLogResponse, PaginatedResponse

router = APIRouter(tags=["audit"])


@router.get("/api/audit", response_model=PaginatedResponse)
async def list_audit_log(
    entity_type: Optional[str] = Query(default=None, max_length=50),
    user_id: Optional[UUID] = Query(default=None),
    from_date: Optional[datetime] = Query(default=None, alias="from"),
    to_date: Optional[datetime] = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_role("admin", "manager")),
):
    """Return paginated audit log for the caller's org.
    Only admins and managers may access the audit log.
    """
    base = select(AuditLog).where(AuditLog.org_id == current_user.org_id)

    if entity_type:
        base = base.where(AuditLog.entity_type == entity_type)
    if user_id:
        base = base.where(AuditLog.user_id == user_id)
    if from_date:
        base = base.where(AuditLog.created_at >= from_date)
    if to_date:
        base = base.where(AuditLog.created_at <= to_date)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar_one()

    rows = await db.execute(
        base.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    data = [AuditLogResponse.model_validate(row) for row in rows.scalars().all()]

    return PaginatedResponse(
        data=data,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )
