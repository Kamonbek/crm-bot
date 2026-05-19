from __future__ import annotations

import pytest
from httpx import AsyncClient


async def test_list_campaigns_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/campaigns")
    assert resp.status_code == 401


async def test_list_campaigns_empty(auth_client: AsyncClient, admin_user):
    resp = await auth_client.get("/api/admin/campaigns")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_create_campaign(auth_client: AsyncClient, admin_user):
    resp = await auth_client.post(
        "/api/admin/campaigns",
        json={"name": "Test Campaign", "slug": "test-camp-1", "is_active": True},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == "test-camp-1"
    assert data["is_active"] is True
    assert "id" in data


async def test_create_campaign_duplicate_slug(auth_client: AsyncClient, admin_user):
    await auth_client.post(
        "/api/admin/campaigns",
        json={"name": "Camp A", "slug": "dup-slug"},
    )
    resp = await auth_client.post(
        "/api/admin/campaigns",
        json={"name": "Camp B", "slug": "dup-slug"},
    )
    assert resp.status_code == 409


async def test_get_campaign(auth_client: AsyncClient, admin_user):
    create_resp = await auth_client.post(
        "/api/admin/campaigns",
        json={"name": "Fetch Me", "slug": "fetch-me-1"},
    )
    campaign_id = create_resp.json()["id"]

    resp = await auth_client.get(f"/api/admin/campaigns/{campaign_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == campaign_id


async def test_get_campaign_not_found(auth_client: AsyncClient, admin_user):
    resp = await auth_client.get(
        "/api/admin/campaigns/00000000-0000-0000-0000-000000000000"
    )
    assert resp.status_code == 404


async def test_update_campaign(auth_client: AsyncClient, admin_user):
    create_resp = await auth_client.post(
        "/api/admin/campaigns",
        json={"name": "Old Name", "slug": "update-test-1"},
    )
    campaign_id = create_resp.json()["id"]

    resp = await auth_client.patch(
        f"/api/admin/campaigns/{campaign_id}",
        json={"name": "New Name", "is_active": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["is_active"] is False
    assert data["slug"] == "update-test-1"


async def test_delete_campaign(auth_client: AsyncClient, admin_user):
    create_resp = await auth_client.post(
        "/api/admin/campaigns",
        json={"name": "Delete Me", "slug": "delete-me-1"},
    )
    campaign_id = create_resp.json()["id"]

    resp = await auth_client.delete(f"/api/admin/campaigns/{campaign_id}")
    assert resp.status_code == 204

    resp = await auth_client.get(f"/api/admin/campaigns/{campaign_id}")
    assert resp.status_code == 404


async def test_stats_requires_auth(client: AsyncClient):
    resp = await client.get("/api/admin/stats")
    assert resp.status_code == 401


async def test_stats_returns_data(auth_client: AsyncClient, admin_user):
    resp = await auth_client.get("/api/admin/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "users" in data
    assert "campaigns" in data
    assert "materials" in data
    assert "sequences" in data
    assert "broadcasts" in data
    assert "scheduled" in data
