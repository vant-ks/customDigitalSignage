"""
Playlist CRUD — items, reordering, and joined media metadata.
Play modes: sequential, shuffle, weighted.
"""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import TokenData, get_current_user
from app.models.models import MediaAsset, Playlist, PlaylistItem
from app.schemas.schemas import (
    PaginatedResponse,
    PlaylistCreate,
    PlaylistItemCreate,
    PlaylistItemResponse,
    PlaylistItemUpdate,
    PlaylistReorderRequest,
    PlaylistResponse,
    PlaylistUpdate,
)

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


# ─── Playlist CRUD ────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_playlist(
    body: PlaylistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    playlist = Playlist(
        org_id=current_user.org_id,
        name=body.name,
        description=body.description,
        play_mode=body.play_mode,
        transition_type=body.transition_type,
        transition_ms=body.transition_ms,
    )
    db.add(playlist)
    await db.flush()
    await db.refresh(playlist)
    return _playlist_response(playlist)


@router.get("")
async def list_playlists(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    q = select(Playlist).where(Playlist.org_id == current_user.org_id)
    if search:
        q = q.where(Playlist.name.ilike(f"%{search}%"))
    if is_active is not None:
        q = q.where(Playlist.is_active == is_active)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()

    q = (
        q.options(
            selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
        .order_by(Playlist.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    playlists = (await db.execute(q)).scalars().all()

    return PaginatedResponse(
        data=[_playlist_response(p) for p in playlists],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    playlist = await _get_playlist_or_404(
        playlist_id, current_user.org_id, db, load_items=True
    )
    return _playlist_response(playlist)


@router.patch("/{playlist_id}")
async def update_playlist(
    playlist_id: UUID,
    body: PlaylistUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    playlist = await _get_playlist_or_404(
        playlist_id, current_user.org_id, db, load_items=True
    )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(playlist, field, value)
    await db.flush()
    await db.refresh(playlist)
    return _playlist_response(playlist)


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(
    playlist_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    playlist = await _get_playlist_or_404(playlist_id, current_user.org_id, db)
    await db.delete(playlist)


# ─── Playlist Items ────────────────────────────────────────────────────────────

@router.post("/{playlist_id}/items", status_code=status.HTTP_201_CREATED)
async def add_playlist_item(
    playlist_id: UUID,
    body: PlaylistItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    # Verify playlist ownership
    playlist = await _get_playlist_or_404(playlist_id, current_user.org_id, db)

    # Verify media asset ownership
    media_result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.id == body.media_id,
            MediaAsset.org_id == current_user.org_id,
        )
    )
    if not media_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Media asset not found")

    item = PlaylistItem(
        playlist_id=playlist.id,
        media_id=body.media_id,
        position=body.position,
        duration_sec=body.duration_sec,
        weight=body.weight,
        transition_type=body.transition_type,
        transition_ms=body.transition_ms,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return PlaylistItemResponse.model_validate(item)


@router.patch("/{playlist_id}/items/{item_id}")
async def update_playlist_item(
    playlist_id: UUID,
    item_id: UUID,
    body: PlaylistItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    await _get_playlist_or_404(playlist_id, current_user.org_id, db)
    item = await _get_item_or_404(item_id, playlist_id, db)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    await db.refresh(item)
    return PlaylistItemResponse.model_validate(item)


@router.delete("/{playlist_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_playlist_item(
    playlist_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    await _get_playlist_or_404(playlist_id, current_user.org_id, db)
    item = await _get_item_or_404(item_id, playlist_id, db)
    await db.delete(item)
    # Re-compact positions after deletion
    await _recompact_positions(playlist_id, db)


@router.patch("/{playlist_id}/items/reorder")
async def reorder_playlist_items(
    playlist_id: UUID,
    body: PlaylistReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Reorder playlist items. Body: {"order": [<item_id>, <item_id>, ...]}
    Each item gets its position set to its index in the list.
    """
    await _get_playlist_or_404(playlist_id, current_user.org_id, db)

    result = await db.execute(
        select(PlaylistItem).where(PlaylistItem.playlist_id == playlist_id)
    )
    items_by_id = {item.id: item for item in result.scalars().all()}

    if set(body.order) != set(items_by_id.keys()):
        raise HTTPException(
            status_code=400,
            detail="order must contain exactly the current item IDs",
        )

    for pos, item_id in enumerate(body.order):
        items_by_id[item_id].position = pos

    await db.flush()
    return {"reordered": len(body.order)}


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_playlist_or_404(
    playlist_id: UUID,
    org_id: UUID,
    db: AsyncSession,
    load_items: bool = False,
) -> Playlist:
    q = select(Playlist).where(
        Playlist.id == playlist_id,
        Playlist.org_id == org_id,
    )
    if load_items:
        q = q.options(
            selectinload(Playlist.items).selectinload(PlaylistItem.media)
        )
    result = await db.execute(q)
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


async def _get_item_or_404(
    item_id: UUID, playlist_id: UUID, db: AsyncSession
) -> PlaylistItem:
    result = await db.execute(
        select(PlaylistItem).where(
            PlaylistItem.id == item_id,
            PlaylistItem.playlist_id == playlist_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Playlist item not found")
    return item


async def _recompact_positions(playlist_id: UUID, db: AsyncSession) -> None:
    """After deletion, renumber positions 0, 1, 2, ... to keep them contiguous."""
    result = await db.execute(
        select(PlaylistItem)
        .where(PlaylistItem.playlist_id == playlist_id)
        .order_by(PlaylistItem.position)
    )
    for pos, item in enumerate(result.scalars().all()):
        item.position = pos
    await db.flush()


def _playlist_response(playlist: Playlist) -> dict:
    data = PlaylistResponse.model_validate(playlist).model_dump()
    data["item_count"] = len(playlist.items) if playlist.items else 0
    data["total_duration_sec"] = sum(
        i.duration_sec for i in (playlist.items or [])
    )
    return data
