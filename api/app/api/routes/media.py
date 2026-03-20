"""
Media Asset routes — register from cloud storage, list, update, delete,
download URL, thumbnail serving, template preview.
"""

import math
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import TokenData, get_current_user
from app.models.models import MediaAsset, StorageProvider
from app.schemas.schemas import (
    MediaAssetCreate,
    MediaAssetResponse,
    MediaAssetUpdate,
    PaginatedResponse,
)
from app.services.media_processor import process_media_asset
from app.services.storage.crypto import decrypt_credentials
from app.services.storage.factory import create_adapter

router = APIRouter(prefix="/api/media", tags=["media"])
settings = get_settings()

THUMBNAIL_DIR = Path("/tmp/vant-media/thumbnails")


# ─── CRUD ────────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def register_media_asset(
    body: MediaAssetCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Register a media asset that lives in a connected storage provider.
    Triggers background processing (metadata extraction + thumbnail generation).
    """
    # Verify storage provider belongs to this org
    provider_result = await db.execute(
        select(StorageProvider).where(
            StorageProvider.id == body.storage_id,
            StorageProvider.org_id == current_user.org_id,
        )
    )
    provider = provider_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Storage provider not found")

    asset = MediaAsset(
        org_id=current_user.org_id,
        storage_id=body.storage_id,
        name=body.name,
        file_type=body.file_type,
        mime_type=body.mime_type,
        source_path=body.source_path,
        folder=body.folder,
        tags=body.tags,
        template_schema=body.template_schema,
        template_data=body.template_data,
        processing_status="pending",
    )
    db.add(asset)
    await db.flush()
    await db.refresh(asset)

    if body.file_type in ("image", "video"):
        # Snapshot credentials now — the background task runs after the session closes
        background_tasks.add_task(
            process_media_asset,
            asset_id=str(asset.id),
            provider_type=provider.provider_type,
            encrypted_credentials=dict(provider.credentials),
        )
    else:
        # HTML templates, URLs, PDFs — no processing needed
        asset.processing_status = "ready"
        await db.flush()

    return MediaAssetResponse.model_validate(asset)


@router.get("")
async def list_media_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    file_type: Optional[str] = Query(None),
    folder: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    processing_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    q = select(MediaAsset).where(MediaAsset.org_id == current_user.org_id)

    if file_type:
        q = q.where(MediaAsset.file_type == file_type)
    if folder:
        q = q.where(MediaAsset.folder == folder)
    if search:
        q = q.where(MediaAsset.name.ilike(f"%{search}%"))
    if tags:
        for tag in [t.strip() for t in tags.split(",") if t.strip()]:
            q = q.where(MediaAsset.tags.contains([tag]))
    if processing_status:
        q = q.where(MediaAsset.processing_status == processing_status)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    q = (
        q.order_by(MediaAsset.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    assets = (await db.execute(q)).scalars().all()

    return PaginatedResponse(
        data=[MediaAssetResponse.model_validate(a) for a in assets],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/{asset_id}")
async def get_media_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    asset = await _get_asset_or_404(asset_id, current_user.org_id, db)
    return MediaAssetResponse.model_validate(asset)


@router.patch("/{asset_id}")
async def update_media_asset(
    asset_id: UUID,
    body: MediaAssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    asset = await _get_asset_or_404(asset_id, current_user.org_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    await db.flush()
    await db.refresh(asset)
    return MediaAssetResponse.model_validate(asset)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_asset(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    asset = await _get_asset_or_404(asset_id, current_user.org_id, db)
    # Clean up thumbnail if present
    thumb = THUMBNAIL_DIR / f"{asset_id}.jpg"
    if thumb.exists():
        thumb.unlink(missing_ok=True)
    await db.delete(asset)


# ─── Download URL ─────────────────────────────────────────────────────────────

@router.get("/{asset_id}/download-url")
async def get_download_url(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Generate a time-limited direct download URL from the asset's cloud provider."""
    asset = await _get_asset_or_404(asset_id, current_user.org_id, db)

    if not asset.storage_id:
        raise HTTPException(status_code=400, detail="Asset has no linked storage provider")

    provider_result = await db.execute(
        select(StorageProvider).where(
            StorageProvider.id == asset.storage_id,
            StorageProvider.org_id == current_user.org_id,
        )
    )
    provider = provider_result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Storage provider not found")

    creds = decrypt_credentials(provider.credentials, settings.secret_key)
    adapter = create_adapter(provider.provider_type, creds)
    try:
        url = await adapter.get_download_url(asset.source_path)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to get download URL: {exc}")

    return {"download_url": url, "expires_in_sec": 3600}


# ─── Thumbnail ────────────────────────────────────────────────────────────────

@router.get("/{asset_id}/thumbnail")
async def get_thumbnail(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Serve the locally generated thumbnail JPEG for an asset."""
    # Verify org ownership before serving
    await _get_asset_or_404(asset_id, current_user.org_id, db)
    thumb_path = THUMBNAIL_DIR / f"{asset_id}.jpg"
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not yet available")
    return FileResponse(str(thumb_path), media_type="image/jpeg")


# ─── Template preview ─────────────────────────────────────────────────────────

@router.get("/{asset_id}/template-preview")
async def preview_template(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Return the HTML template rendered with its current template_data."""
    from fastapi.responses import HTMLResponse

    asset = await _get_asset_or_404(asset_id, current_user.org_id, db)
    if asset.file_type != "html_template":
        raise HTTPException(status_code=400, detail="Asset is not an HTML template")
    if not asset.source_path:
        raise HTTPException(status_code=400, detail="Template has no source content")

    # Simple Mustache-style {{key}} substitution
    template_html = asset.source_path  # source_path stores raw HTML for html_template type
    data = asset.template_data or {}
    for key, value in data.items():
        template_html = template_html.replace(f"{{{{{key}}}}}", str(value))

    return HTMLResponse(content=template_html)


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_asset_or_404(
    asset_id: UUID, org_id: UUID, db: AsyncSession
) -> MediaAsset:
    result = await db.execute(
        select(MediaAsset).where(
            MediaAsset.id == asset_id,
            MediaAsset.org_id == org_id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Media asset not found")
    return asset
