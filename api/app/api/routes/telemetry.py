"""
Device telemetry history endpoints.

GET /api/displays/{display_id}/telemetry?period=24h|7d|30d
Returns time-series telemetry rows for charting in the monitoring dashboard.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import TokenData, get_current_user
from app.models.models import DeviceTelemetry, Display
from app.schemas.schemas import TelemetryDataPoint, TelemetryResponse

router = APIRouter(prefix="/api/displays", tags=["telemetry"])

_PERIOD_MAP: dict[str, timedelta] = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


@router.get("/{display_id}/telemetry", response_model=TelemetryResponse)
async def get_display_telemetry(
    display_id: UUID,
    period: str = Query(default="24h", pattern=r"^(1h|6h|24h|7d|30d)$"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Return telemetry time-series for a display within the requested period."""
    # Verify display belongs to the caller's org
    result = await db.execute(
        select(Display).where(
            Display.id == display_id,
            Display.org_id == current_user.org_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Display not found")

    since = datetime.now(timezone.utc) - _PERIOD_MAP[period]

    rows = await db.execute(
        select(DeviceTelemetry)
        .where(
            DeviceTelemetry.display_id == display_id,
            DeviceTelemetry.recorded_at >= since,
        )
        .order_by(DeviceTelemetry.recorded_at.asc())
    )
    points = [TelemetryDataPoint.model_validate(r) for r in rows.scalars().all()]

    return TelemetryResponse(display_id=display_id, period=period, data=points)
