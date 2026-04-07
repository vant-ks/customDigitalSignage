"""
Tests for authentication endpoints:
  POST /api/auth/register
  POST /api/auth/login
  POST /api/auth/refresh
"""

import pytest
from httpx import AsyncClient

REGISTER_PAYLOAD = {
    "org_name": "Test Org",
    "org_slug": "test-org",
    "admin_name": "Alice Admin",
    "admin_email": "alice@test.org",
    "password": "Secure1234!",
}


@pytest.mark.asyncio
async def test_register_creates_org_and_admin(client: AsyncClient):
    resp = await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    assert resp.status_code == 201, resp.text
    data = resp.json()

    assert data["user"]["email"] == "alice@test.org"
    assert data["user"]["role"] == "admin"
    assert data["organization"]["slug"] == "test-org"
    assert "access_token" in data["tokens"]
    assert "refresh_token" in data["tokens"]


@pytest.mark.asyncio
async def test_register_duplicate_slug_rejected(client: AsyncClient):
    # First registration
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    # Duplicate slug
    resp = await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    assert resp.status_code in (400, 409), resp.text


@pytest.mark.asyncio
async def test_login_returns_tokens(client: AsyncClient):
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/auth/login",
        json={
            "email": "alice@test.org",
            "password": "Secure1234!",
            "org_slug": "test-org",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["tokens"]["access_token"]


@pytest.mark.asyncio
async def test_login_wrong_password_rejected(client: AsyncClient):
    await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    resp = await client.post(
        "/api/auth/login",
        json={
            "email": "alice@test.org",
            "password": "wrongpassword",
            "org_slug": "test-org",
        },
    )
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_login_unknown_org_rejected(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={
            "email": "nobody@nowhere.com",
            "password": "irrelevant",
            "org_slug": "no-such-org",
        },
    )
    assert resp.status_code in (401, 404), resp.text


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    reg = await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    refresh_token = reg.json()["tokens"]["refresh_token"]

    resp = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["tokens"]["access_token"]


@pytest.mark.asyncio
async def test_refresh_invalid_token_rejected(client: AsyncClient):
    resp = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": "not.a.valid.jwt"},
    )
    assert resp.status_code in (401, 422), resp.text


@pytest.mark.asyncio
async def test_protected_endpoint_requires_auth(client: AsyncClient):
    resp = await client.get("/api/displays")
    assert resp.status_code == 401, resp.text


@pytest.mark.asyncio
async def test_protected_endpoint_accepts_valid_token(client: AsyncClient):
    reg = await client.post("/api/auth/register", json=REGISTER_PAYLOAD)
    token = reg.json()["tokens"]["access_token"]

    resp = await client.get(
        "/api/displays",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
