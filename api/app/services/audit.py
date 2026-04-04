"""
Audit log write helper.

Usage:
    from app.services.audit import write_audit

    await write_audit(
        db=db,
        user=current_user,
        action="display.create",
        entity_type="display",
        entity_id=display.id,
        details={"name": display.name},
        request=request,   # optional — extracts ip/user-agent
    )

The helper adds the AuditLog row to the current session.
The caller is responsible for committing the transaction.
"""

from typing import Any
from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData
from app.models.models import AuditLog


async def write_audit(
    *,
    db: AsyncSession,
    user: TokenData,
    action: str,
    entity_type: str,
    entity_id: UUID | None = None,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Add an AuditLog row to *db*.  Does NOT commit — caller must commit."""
    ip_address: str | None = None
    user_agent: str | None = None

    if request is not None:
        # Prefer X-Forwarded-For (set by Railway / reverse proxies)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first (client) IP from a comma-separated list
            ip_address = forwarded_for.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    log = AuditLog(
        org_id=user.org_id,
        user_id=user.user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
