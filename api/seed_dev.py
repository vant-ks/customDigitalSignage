"""
DEV ONLY — seed an admin account for local development.

Usage (from api/ directory):
    python seed_dev.py

Creates:
    Org:  GJS Media  (slug: gjs-media)
    User: Kevin Shea  <kevin@gjsmedia.com>  role: admin
    Pass: admin

Safe to re-run — skips creation if the slug/email already exists.
"""

import asyncio
import sys

from sqlalchemy import select

from app.core.database import async_session_factory, engine
from app.core.security import hash_password
from app.models.models import Base, Organization, User

ORG_NAME  = "GJS Media"
ORG_SLUG  = "gjs-media"
ADMIN_NAME  = "Kevin Shea"
ADMIN_EMAIL = "kevin@gjsmedia.com"
ADMIN_PASS  = "admin"


async def seed() -> None:
    # Ensure tables exist (harmless if already created by Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        # ── org ──────────────────────────────────────────────────────────────
        result = await db.execute(
            select(Organization).where(Organization.slug == ORG_SLUG)
        )
        org = result.scalar_one_or_none()

        if org is None:
            org = Organization(name=ORG_NAME, slug=ORG_SLUG)
            db.add(org)
            await db.flush()
            print(f"[seed] Created org: {ORG_NAME} (slug={ORG_SLUG})")
        else:
            print(f"[seed] Org already exists: {ORG_SLUG}")

        # ── user ─────────────────────────────────────────────────────────────
        result = await db.execute(
            select(User).where(User.email == ADMIN_EMAIL)
        )
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                org_id=org.id,
                email=ADMIN_EMAIL,
                name=ADMIN_NAME,
                password_hash=hash_password(ADMIN_PASS),
                role="admin",
            )
            db.add(user)
            print(f"[seed] Created user: {ADMIN_EMAIL} (password: {ADMIN_PASS})")
        else:
            print(f"[seed] User already exists: {ADMIN_EMAIL}")

        await db.commit()

    print("[seed] Done.")


if __name__ == "__main__":
    asyncio.run(seed())
