"""
Alert rules and notification management.

Alert rules:
  GET    /api/alert-rules                  list all rules for org
  POST   /api/alert-rules                  create rule
  GET    /api/alert-rules/{id}             get single rule
  PATCH  /api/alert-rules/{id}             update rule
  DELETE /api/alert-rules/{id}             delete rule

Notifications:
  GET    /api/notifications                list (unread first, paginated)
  GET    /api/notifications/unread-count   quick badge count
  PATCH  /api/notifications/{id}/read      mark single read
  POST   /api/notifications/read-all       mark all read for org
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import TokenData, get_current_user, require_role
from app.models.models import AlertRule, Notification
from app.schemas.schemas import (
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
    NotificationResponse,
    PaginatedResponse,
)

router = APIRouter(tags=["alerts"])


# ─── Alert Rules ─────────────────────────────────────────────────────────────


async def _get_rule_or_404(rule_id: UUID, org_id: UUID, db: AsyncSession) -> AlertRule:
    result = await db.execute(
        select(AlertRule).where(AlertRule.id == rule_id, AlertRule.org_id == org_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return rule


@router.get("/api/alert-rules", response_model=list[AlertRuleResponse])
async def list_alert_rules(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.execute(
        select(AlertRule)
        .where(AlertRule.org_id == current_user.org_id)
        .order_by(AlertRule.created_at.desc())
    )
    return [AlertRuleResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/api/alert-rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    body: AlertRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_role("admin", "manager")),
):
    rule = AlertRule(org_id=current_user.org_id, **body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return AlertRuleResponse.model_validate(rule)


@router.get("/api/alert-rules/{rule_id}", response_model=AlertRuleResponse)
async def get_alert_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    rule = await _get_rule_or_404(rule_id, current_user.org_id, db)
    return AlertRuleResponse.model_validate(rule)


@router.patch("/api/alert-rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: UUID,
    body: AlertRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_role("admin", "manager")),
):
    rule = await _get_rule_or_404(rule_id, current_user.org_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    rule.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(rule)
    return AlertRuleResponse.model_validate(rule)


@router.delete("/api/alert-rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_role("admin", "manager")),
):
    rule = await _get_rule_or_404(rule_id, current_user.org_id, db)
    await db.delete(rule)
    await db.commit()


# ─── Notifications ───────────────────────────────────────────────────────────


@router.get("/api/notifications/unread-count")
async def unread_notification_count(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count()).where(
            Notification.org_id == current_user.org_id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    return {"count": result.scalar_one()}


@router.get("/api/notifications", response_model=PaginatedResponse)
async def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    unread_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    base = select(Notification).where(Notification.org_id == current_user.org_id)
    if unread_only:
        base = base.where(Notification.is_read == False)  # noqa: E712

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar_one()

    rows = await db.execute(
        base.order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    data = [NotificationResponse.model_validate(n) for n in rows.scalars().all()]

    import math
    return PaginatedResponse(
        data=data,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.patch("/api/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.org_id == current_user.org_id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    notif.read_by = current_user.user_id
    notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notif)
    return NotificationResponse.model_validate(notif)


@router.post("/api/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Notification)
        .where(
            Notification.org_id == current_user.org_id,
            Notification.is_read == False,  # noqa: E712
        )
        .values(is_read=True, read_by=current_user.user_id, read_at=now)
    )
    await db.commit()
