from __future__ import annotations

import pytest
from httpx import AsyncClient

_EMAIL = "admin@test.example"
_PASSWORD = "testpass123"


async def test_login_success(client: AsyncClient, admin_user):
    resp = await client.post(
        "/api/auth/login", json={"email": _EMAIL, "password": _PASSWORD}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient, admin_user):
    resp = await client.post(
        "/api/auth/login", json={"email": _EMAIL, "password": "wrong"}
    )
    assert resp.status_code == 401


async def test_login_unknown_email(client: AsyncClient, admin_user):
    resp = await client.post(
        "/api/auth/login", json={"email": "nobody@test.example", "password": _PASSWORD}
    )
    assert resp.status_code == 401


async def test_me_authenticated(auth_client: AsyncClient, admin_user):
    resp = await auth_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == _EMAIL
    assert data["is_active"] is True


async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_invalid_token(client: AsyncClient):
    resp = await client.get(
        "/api/auth/me", headers={"Authorization": "Bearer not.a.real.token"}
    )
    assert resp.status_code == 401
