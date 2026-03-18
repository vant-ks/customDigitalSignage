"""
Auth routes: register org, login, refresh token.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.models import Organization, User
from app.schemas.schemas import (
    AuthResponse,
    LoginRequest,
    OrgResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new organization with an admin user."""
    # Check slug uniqueness
    existing = await db.execute(
        select(Organization).where(Organization.slug == req.org_slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already taken",
        )

    # Create org
    org = Organization(name=req.org_name, slug=req.org_slug)
    db.add(org)
    await db.flush()

    # Create admin user
    user = User(
        org_id=org.id,
        email=req.admin_email,
        name=req.admin_name,
        password_hash=hash_password(req.password),
        role="admin",
    )
    db.add(user)
    await db.flush()

    # Generate tokens
    access = create_access_token(str(user.id), str(org.id), user.role)
    refresh = create_refresh_token(str(user.id), str(org.id))

    return AuthResponse(
        user=UserResponse.model_validate(user),
        organization=OrgResponse.model_validate(org),
        tokens=TokenResponse(
            access_token=access,
            refresh_token=refresh,
            expires_in=settings.access_token_expire_minutes * 60,
        ),
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    # Find org
    result = await db.execute(
        select(Organization).where(Organization.slug == req.org_slug)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Find user
    result = await db.execute(
        select(User).where(User.org_id == org.id, User.email == req.email)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)

    # Generate tokens
    access = create_access_token(str(user.id), str(org.id), user.role)
    refresh = create_refresh_token(str(user.id), str(org.id))

    return AuthResponse(
        user=UserResponse.model_validate(user),
        organization=OrgResponse.model_validate(org),
        tokens=TokenResponse(
            access_token=access,
            refresh_token=refresh,
            expires_in=settings.access_token_expire_minutes * 60,
        ),
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a refresh token for new access + refresh tokens."""
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    org_id = payload.get("org")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or str(user.org_id) != org_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    result = await db.execute(select(Organization).where(Organization.id == user.org_id))
    org = result.scalar_one_or_none()

    access = create_access_token(str(user.id), str(org.id), user.role)
    refresh_tok = create_refresh_token(str(user.id), str(org.id))

    return AuthResponse(
        user=UserResponse.model_validate(user),
        organization=OrgResponse.model_validate(org),
        tokens=TokenResponse(
            access_token=access,
            refresh_token=refresh_tok,
            expires_in=settings.access_token_expire_minutes * 60,
        ),
    )
