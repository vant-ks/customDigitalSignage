"""
Shared test fixtures.

Uses an in-memory SQLite database (via aiosqlite) so tests run without a
real PostgreSQL instance.  SQLite does not support JSONB or ARRAY natively;
we teach the SQLite type compiler how to render them as TEXT.

The test database is created fresh for each test session.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# ─── SQLite dialect shim ──────────────────────────────────────────────────────
# Teach SQLite's type compiler to render PG-specific DDL types as compatible
# SQLite types.  Must happen BEFORE models are imported.

import uuid as _uuid_mod
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
from sqlalchemy.dialects.sqlite import base as _sqlite_base

# JSONB → TEXT
SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "TEXT"  # type: ignore[attr-defined]
# ARRAY → TEXT
SQLiteTypeCompiler.visit_ARRAY = lambda self, type_, **kw: "TEXT"  # type: ignore[attr-defined]
# postgresql.UUID → VARCHAR(36)
SQLiteTypeCompiler.visit_UUID = lambda self, type_, **kw: "VARCHAR(36)"  # type: ignore[attr-defined]

# postgresql.UUID bind/result processors assume native uuid.UUID objects; patch
# them to tolerate plain strings so round-trips through SQLite work correctly.
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

_orig_bind = PG_UUID.bind_processor
_orig_result = PG_UUID.result_processor


def _safe_bind_processor(self, dialect):
    def process(value):
        if value is None:
            return None
        if isinstance(value, _uuid_mod.UUID):
            return str(value)
        return str(value)  # already a string
    return process


def _safe_result_processor(self, dialect, coltype):
    def process(value):
        if value is None:
            return None
        if isinstance(value, _uuid_mod.UUID):
            return value
        try:
            return _uuid_mod.UUID(value)
        except (ValueError, AttributeError):
            return value
    return process


PG_UUID.bind_processor = _safe_bind_processor  # type: ignore[method-assign]
PG_UUID.result_processor = _safe_result_processor  # type: ignore[method-assign]

# Now safe to import models / app (which reference postgresql.JSONB / ARRAY / UUID)
from app.core.database import Base, get_db
from app.main import app


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def engine():
    """Per-test in-memory engine — ensures a clean DB for every test."""
    eng = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(engine):
    """HTTP test client with the app wired to the in-memory DB."""
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _get_test_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _get_test_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
