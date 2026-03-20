"""
Storage Provider routes — OAuth connection management + file browser.

OAuth flow:
  1. Frontend: GET /api/storage-providers/auth-url/{provider} → receives {auth_url, state}
  2. User: browser redirected to provider auth page
  3. Provider: redirects to {redirect_uri}?code=...&state=...
  4. Frontend: POST /api/storage-providers/oauth/exchange {code, state, label}
  5. Backend: exchanges code → tokens → encrypts → saves StorageProvider record
"""

import base64
import hashlib
import hmac
import json
import secrets
from typing import Optional
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import TokenData, get_current_user
from app.models.models import StorageProvider
from app.schemas.schemas import StorageProviderResponse
from app.services.storage.crypto import decrypt_credentials, encrypt_credentials
from app.services.storage.factory import create_adapter

router = APIRouter(prefix="/api/storage-providers", tags=["storage"])
settings = get_settings()

# ─── OAuth constants ─────────────────────────────────────────────────────────

_AUTH_URLS = {
    "dropbox": "https://www.dropbox.com/oauth2/authorize",
    "gdrive": "https://accounts.google.com/o/oauth2/v2/auth",
    "onedrive": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
}
_TOKEN_URLS = {
    "dropbox": "https://api.dropbox.com/oauth2/token",
    "gdrive": "https://oauth2.googleapis.com/token",
    "onedrive": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
}
_SCOPES = {
    "dropbox": "files.content.read offline_access",
    "gdrive": "https://www.googleapis.com/auth/drive.readonly",
    "onedrive": "Files.Read offline_access",
}


def _client_creds(provider_type: str) -> tuple[str, str]:
    match provider_type:
        case "dropbox":
            return settings.dropbox_client_id, settings.dropbox_client_secret
        case "gdrive":
            return settings.gdrive_client_id, settings.gdrive_client_secret
        case "onedrive":
            return settings.onedrive_client_id, settings.onedrive_client_secret
        case _:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider_type!r}")


# ─── State signing (CSRF protection) ─────────────────────────────────────────

def _sign_state(payload: dict) -> str:
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig = hmac.new(
        settings.secret_key.encode(), data.encode(), hashlib.sha256
    ).hexdigest()
    return f"{data}.{sig}"


def _verify_state(state: str) -> dict:
    try:
        data, sig = state.rsplit(".", 1)
        expected = hmac.new(
            settings.secret_key.encode(), data.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("Signature mismatch")
        return json.loads(base64.urlsafe_b64decode(data + "=="))
    except Exception as exc:
        raise ValueError(f"Invalid state: {exc}") from exc


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/auth-url/{provider_type}")
async def get_auth_url(
    provider_type: str,
    redirect_uri: str = Query(..., description="Frontend URL that receives the OAuth callback"),
    current_user: TokenData = Depends(get_current_user),
):
    """Return the OAuth authorization URL to redirect the user to."""
    if provider_type not in _AUTH_URLS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider_type!r}")

    client_id, _ = _client_creds(provider_type)
    if not client_id:
        raise HTTPException(
            status_code=503,
            detail=f"{provider_type} OAuth credentials not configured on this server",
        )

    state = _sign_state({
        "org": str(current_user.org_id),
        "provider": provider_type,
        "redirect_uri": redirect_uri,
        "nonce": secrets.token_urlsafe(16),
    })

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": _SCOPES[provider_type],
        "state": state,
        # Provider-specific: force refresh token issuance
        "access_type": "offline",       # Google
        "prompt": "consent",            # Google — required to get refresh_token every time
        "token_access_type": "offline", # Dropbox
    }
    auth_url = f"{_AUTH_URLS[provider_type]}?{urlencode(params)}"
    return {"auth_url": auth_url, "state": state}


@router.post("/oauth/exchange", status_code=status.HTTP_201_CREATED)
async def exchange_oauth_code(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Exchange an OAuth authorization code for tokens.
    Creates a new StorageProvider record with encrypted credentials.
    """
    code: str = body.get("code", "")
    state: str = body.get("state", "")
    label: str = body.get("label", "")

    if not code or not state:
        raise HTTPException(status_code=400, detail="code and state are required")

    try:
        state_data = _verify_state(state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if str(current_user.org_id) != state_data.get("org"):
        raise HTTPException(status_code=403, detail="State org_id does not match authenticated user")

    provider_type: str = state_data["provider"]
    redirect_uri: str = state_data["redirect_uri"]
    client_id, client_secret = _client_creds(provider_type)

    # Exchange code for tokens
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _TOKEN_URLS[provider_type],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Token exchange failed ({resp.status_code}): {resp.text[:200]}",
        )

    tokens = resp.json()
    credentials = {
        "access_token": tokens.get("access_token"),
        "refresh_token": tokens.get("refresh_token"),
        "token_type": tokens.get("token_type", "Bearer"),
    }
    encrypted = encrypt_credentials(credentials, settings.secret_key)

    provider = StorageProvider(
        org_id=current_user.org_id,
        provider_type=provider_type,
        label=label or provider_type.title(),
        credentials=encrypted,
        is_active=True,
    )
    db.add(provider)
    await db.flush()
    await db.refresh(provider)
    return StorageProviderResponse.model_validate(provider)


@router.get("")
async def list_storage_providers(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.execute(
        select(StorageProvider).where(StorageProvider.org_id == current_user.org_id)
    )
    providers = result.scalars().all()
    return [StorageProviderResponse.model_validate(p) for p in providers]


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_storage_provider(
    provider_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.execute(
        select(StorageProvider).where(
            StorageProvider.id == provider_id,
            StorageProvider.org_id == current_user.org_id,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Storage provider not found")
    await db.delete(provider)


@router.get("/{provider_id}/browse")
async def browse_storage(
    provider_id: UUID,
    path: str = Query("/", description="Folder path or item ID to list"),
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
):
    """Browse files and folders in a connected storage provider."""
    result = await db.execute(
        select(StorageProvider).where(
            StorageProvider.id == provider_id,
            StorageProvider.org_id == current_user.org_id,
            StorageProvider.is_active == True,
        )
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Storage provider not found")

    creds = decrypt_credentials(provider.credentials, settings.secret_key)
    try:
        adapter = create_adapter(provider.provider_type, creds)
        file_list = await adapter.list_files(path, cursor)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="Storage provider token expired — please reconnect",
            )
        raise HTTPException(
            status_code=502,
            detail=f"Storage API error {exc.response.status_code}",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Browse failed: {exc}")

    return {
        "entries": [
            {
                "name": e.name,
                "path": e.path,
                "is_folder": e.is_folder,
                "size_bytes": e.size_bytes,
                "modified_at": e.modified_at,
                "mime_type": e.mime_type,
                "thumbnail_url": e.thumbnail_url,
            }
            for e in file_list.entries
        ],
        "cursor": file_list.cursor,
        "has_more": file_list.has_more,
    }
