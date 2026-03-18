"""
User CRUD — org-scoped, role-restricted.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import TokenData, get_current_user, hash_password, require_role
from app.models.models import User
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User)
        .where(User.org_id == current_user.org_id)
        .order_by(User.name)
    )
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    req: UserCreate,
    current_user: TokenData = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    # Check email uniqueness within org
    existing = await db.execute(
        select(User).where(
            User.org_id == current_user.org_id, User.email == req.email
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists in org")

    user = User(
        org_id=current_user.org_id,
        email=req.email,
        name=req.name,
        password_hash=hash_password(req.password),
        role=req.role,
    )
    db.add(user)
    await db.flush()
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    req: UserUpdate,
    current_user: TokenData = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.id == user_id, User.org_id == current_user.org_id
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.flush()
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    current_user: TokenData = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(
        select(User).where(
            User.id == user_id, User.org_id == current_user.org_id
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
