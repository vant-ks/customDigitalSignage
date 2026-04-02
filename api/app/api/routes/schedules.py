"""
Schedule CRUD, resolver, emergency override, content manifest, and sync status.

Resolution order (highest to lowest priority):
  1. is_override=True schedules (emergency overrides)
  2. Higher priority value wins
  3. Specificity: display-targeted > group-targeted > org-wide (no target)
"""

import hashlib
import json
import math
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import TokenData, get_current_user, require_role
from app.models.models import Display, MediaAsset, Playlist, PlaylistItem, Schedule
from app.schemas.schemas import (
    ContentManifestResponse,
    ManifestMediaItemSchema,
    ManifestPlaylistItemSchema,
    ManifestPlaylistSchema,
    ManifestScheduleEntrySchema,
    PaginatedResponse,
    ScheduleCreate,
    ScheduleOverrideRequest,
    ScheduleResponse,
    ScheduleUpdate,
    SyncStatusRequest,
)
from app.websocket.manager import ws_manager

router = APIRouter(tags=["schedules"])


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _schedule_response(s: Schedule) -> ScheduleResponse:
    return ScheduleResponse.model_validate(s)


async def _get_schedule_or_404(
    schedule_id: UUID, org_id: UUID, db: AsyncSession
) -> Schedule:
    result = await db.execute(
        select(Schedule).where(Schedule.id == schedule_id, Schedule.org_id == org_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return s


def _is_schedule_active_at(s: Schedule, at: datetime) -> bool:
    """Return True if this schedule applies at the given UTC datetime."""
    if not s.is_active:
        return False

    if s.schedule_type == "always":
        return True

    if s.schedule_type == "one_time":
        if s.start_date and at < s.start_date:
            return False
        if s.end_date and at > s.end_date:
            return False
        return True

    if s.schedule_type == "recurring":
        # Check day of week (0=Mon…6=Sun per isoweekday mapping)
        weekday = at.weekday()  # 0=Monday, 6=Sunday
        if s.days_of_week and weekday not in s.days_of_week:
            return False
        # Check time window
        if s.start_time or s.end_time:
            time_str = at.strftime("%H:%M:%S")
            start = (s.start_time or "00:00")[:5]
            end = (s.end_time or "23:59")[:5]
            current = time_str[:5]
            if start <= end:
                if not (start <= current <= end):
                    return False
            else:
                # Overnight window e.g. 22:00–06:00
                if not (current >= start or current <= end):
                    return False
        return True

    return False


def _specificity(s: Schedule) -> int:
    """Higher value = more specific target."""
    if s.display_id is not None:
        return 2
    if s.group_id is not None:
        return 1
    return 0


def _build_manifest_playlist(playlist: Playlist) -> ManifestPlaylistSchema:
    items = []
    for item in sorted(playlist.items, key=lambda x: x.position):
        if item.media is None:
            continue
        media = item.media
        items.append(
            ManifestPlaylistItemSchema(
                id=str(item.id),
                media=ManifestMediaItemSchema(
                    id=str(media.id),
                    name=media.name,
                    file_type=media.file_type,
                    source_url=media.processed_url or media.source_path,
                    source_hash=media.source_hash,
                    file_size_bytes=media.file_size_bytes,
                    duration_sec=media.duration_sec,
                    width=media.width,
                    height=media.height,
                ),
                position=item.position,
                duration_sec=item.duration_sec,
                transition_type=item.transition_type or playlist.transition_type or "cut",
                transition_ms=item.transition_ms if item.transition_ms is not None else playlist.transition_ms,
            )
        )
    return ManifestPlaylistSchema(
        id=str(playlist.id),
        name=playlist.name,
        play_mode=playlist.play_mode,
        items=items,
    )


# ─── Schedule CRUD ────────────────────────────────────────────────────────────


@router.post("/api/schedules", status_code=status.HTTP_201_CREATED)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    # Verify playlist belongs to org
    playlist = await db.get(Playlist, body.playlist_id)
    if not playlist or playlist.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Playlist not found")

    s = Schedule(
        org_id=current_user.org_id,
        **body.model_dump(),
    )
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return _schedule_response(s)


@router.get("/api/schedules")
async def list_schedules(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    display_id: Optional[UUID] = Query(None),
    group_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    q = select(Schedule).where(Schedule.org_id == current_user.org_id)
    if display_id is not None:
        q = q.where(Schedule.display_id == display_id)
    if group_id is not None:
        q = q.where(Schedule.group_id == group_id)
    if is_active is not None:
        q = q.where(Schedule.is_active == is_active)

    from sqlalchemy import func
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()

    schedules = (
        await db.execute(
            q.order_by(Schedule.priority.desc(), Schedule.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return PaginatedResponse(
        data=[_schedule_response(s) for s in schedules],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/api/schedules/{schedule_id}")
async def get_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    return _schedule_response(
        await _get_schedule_or_404(schedule_id, current_user.org_id, db)
    )


@router.patch("/api/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: UUID,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    s = await _get_schedule_or_404(schedule_id, current_user.org_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    await db.flush()
    await db.refresh(s)
    return _schedule_response(s)


@router.delete("/api/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    s = await _get_schedule_or_404(schedule_id, current_user.org_id, db)
    await db.delete(s)
    await db.flush()


# ─── Emergency override ───────────────────────────────────────────────────────


@router.post("/api/schedules/override", status_code=status.HTTP_201_CREATED)
async def create_override(
    body: ScheduleOverrideRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    playlist = await db.get(Playlist, body.playlist_id)
    if not playlist or playlist.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Playlist not found")

    end_date = None
    if body.auto_expire_minutes:
        end_date = datetime.now(timezone.utc) + timedelta(minutes=body.auto_expire_minutes)

    s = Schedule(
        org_id=current_user.org_id,
        name=body.name,
        display_id=body.display_id,
        group_id=body.group_id,
        playlist_id=body.playlist_id,
        schedule_type="always",
        priority=body.priority,
        is_override=True,
        is_active=True,
        end_date=end_date,
    )
    db.add(s)
    await db.flush()
    await db.refresh(s)

    # Notify connected displays via WebSocket
    async def _notify():
        await ws_manager.broadcast_to_org(
            current_user.org_id,
            {"type": "schedule_override", "schedule_id": str(s.id)},
        )

    background_tasks.add_task(_notify)
    return _schedule_response(s)


# ─── Schedule resolver ────────────────────────────────────────────────────────


@router.get("/api/displays/{display_id}/active-schedule")
async def get_active_schedule(
    display_id: UUID,
    at: Optional[datetime] = Query(None, description="ISO datetime; defaults to now UTC"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    display = await db.get(Display, display_id)
    if not display or display.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Display not found")

    now = at or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    # Fetch all active org schedules that could apply to this display
    result = await db.execute(
        select(Schedule).where(
            Schedule.org_id == current_user.org_id,
            Schedule.is_active == True,
        )
    )
    all_schedules = result.scalars().all()

    # Filter to schedules targeting this display, its group, or org-wide
    candidates = [
        s for s in all_schedules
        if (
            s.display_id == display_id
            or (s.group_id is not None and s.group_id == display.group_id)
            or (s.display_id is None and s.group_id is None)
        )
        and _is_schedule_active_at(s, now)
    ]

    if not candidates:
        return {"display_id": str(display_id), "at": now.isoformat(), "active_schedule": None}

    # Sort: overrides first, then priority desc, then specificity desc
    candidates.sort(key=lambda s: (s.is_override, s.priority, _specificity(s)), reverse=True)
    winner = candidates[0]

    return {
        "display_id": str(display_id),
        "at": now.isoformat(),
        "active_schedule": _schedule_response(winner).model_dump(),
    }


# ─── Content manifest ─────────────────────────────────────────────────────────


@router.get("/api/displays/{display_id}/manifest")
async def get_manifest(
    display_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    display = await db.get(Display, display_id)
    if not display or display.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Display not found")

    cache_policy = display.cache_policy or {}
    depth_days = cache_policy.get("depth_days", 7)
    window_end = datetime.now(timezone.utc) + timedelta(days=depth_days)

    result = await db.execute(
        select(Schedule).where(
            Schedule.org_id == current_user.org_id,
            Schedule.is_active == True,
        )
    )
    all_schedules = result.scalars().all()

    # Filter to schedules relevant for this display within the cache window
    relevant = [
        s for s in all_schedules
        if (
            s.display_id == display_id
            or (s.group_id is not None and s.group_id == display.group_id)
            or (s.display_id is None and s.group_id is None)
        )
        and (s.end_date is None or s.end_date >= datetime.now(timezone.utc))
        and (s.start_date is None or s.start_date <= window_end)
    ]

    # Collect unique playlist_ids and load them with items + media
    playlist_ids = list({s.playlist_id for s in relevant})
    playlists_by_id: dict = {}
    if playlist_ids:
        pl_result = await db.execute(
            select(Playlist)
            .where(Playlist.id.in_(playlist_ids))
            .options(selectinload(Playlist.items).selectinload(PlaylistItem.media))
        )
        for pl in pl_result.scalars().all():
            playlists_by_id[pl.id] = pl

    # Sort: overrides first, then priority desc, then specificity desc
    relevant.sort(key=lambda s: (s.is_override, s.priority, _specificity(s)), reverse=True)

    schedule_entries = []
    for s in relevant:
        pl = playlists_by_id.get(s.playlist_id)
        if not pl:
            continue
        schedule_entries.append(
            ManifestScheduleEntrySchema(
                id=str(s.id),
                playlist=_build_manifest_playlist(pl),
                schedule_type=s.schedule_type,
                days_of_week=s.days_of_week or [],
                start_time=s.start_time,
                end_time=s.end_time,
                start_date=s.start_date,
                end_date=s.end_date,
                priority=s.priority,
                is_override=s.is_override,
            )
        )

    # Fallback playlist from cache_policy
    fallback_pl = None
    fallback_id = cache_policy.get("fallback_media_id")
    if fallback_id and UUID(fallback_id) in playlists_by_id:
        fallback_pl = _build_manifest_playlist(playlists_by_id[UUID(fallback_id)])

    manifest = ContentManifestResponse(
        display_id=str(display_id),
        manifest_hash="",
        generated_at=datetime.now(timezone.utc),
        cache_policy=cache_policy,
        schedules=schedule_entries,
        fallback_playlist=fallback_pl,
    )

    # Hash the manifest content (without the hash field itself)
    manifest_dict = manifest.model_dump(mode="json")
    manifest_dict.pop("manifest_hash")
    manifest.manifest_hash = hashlib.sha256(
        json.dumps(manifest_dict, sort_keys=True, default=str).encode()
    ).hexdigest()[:16]

    return manifest


# ─── Device sync status ───────────────────────────────────────────────────────


@router.post("/api/devices/{display_id}/sync-status", status_code=status.HTTP_204_NO_CONTENT)
async def report_sync_status(
    display_id: UUID,
    body: SyncStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    display = await db.get(Display, display_id)
    if not display or display.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="Display not found")

    # Update cache_policy with reported sync state
    cp = dict(display.cache_policy or {})
    cp["last_sync_at"] = body.last_sync_at.isoformat() if body.last_sync_at else None
    cp["sync_status"] = body.sync_status
    cp["cache_used_gb"] = body.cache_used_gb
    display.cache_policy = cp
    await db.flush()
