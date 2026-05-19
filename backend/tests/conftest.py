from __future__ import annotations

import os

# Force test-safe values before any app import.
# DATABASE_URL is always overridden to sqlite so tests never need a real Postgres server.
os.environ["ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:5173")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
os.environ.setdefault("JWT_SECRET", "test-only-jwt-secret-key-32-chars-padding!!")

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app import models  # noqa: F401  # register models on Base.metadata
from app.config import get_settings
from app.db.base import Base
from app.main import create_app

_ADMIN_EMAIL = "admin@test.example"
_ADMIN_PASSWORD = "testpass123"


@pytest.fixture(scope="session")
def settings():
    get_settings.cache_clear()
    return get_settings()


@pytest.fixture(scope="session")
def app(settings):
    return create_app(settings)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_app_tables(app):
    """Create all tables on the app's global engine once per session.

    Needed so the aiogram DbSessionMiddleware (which uses get_session_factory)
    has a valid schema when webhook tests run through the HTTP layer.
    """
    from app.db.session import get_engine

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_user(_create_app_tables):
    """Admin user seeded into the app's global engine for HTTP-layer tests."""
    from app.core.security import hash_password
    from app.db.session import get_session_factory
    from app.repositories import admin_users as admin_repo

    factory = get_session_factory()
    async with factory() as session:
        existing = await admin_repo.get_by_email(session, _ADMIN_EMAIL)
        if existing:
            return existing
        admin = await admin_repo.create(
            session,
            email=_ADMIN_EMAIL,
            password_hash=hash_password(_ADMIN_PASSWORD),
        )
        await session.commit()
    return admin


@pytest.fixture
def auth_headers(admin_user):
    from app.core.security import create_access_token

    token = create_access_token(subject=admin_user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, auth_headers: dict) -> AsyncClient:
    client.headers.update(auth_headers)
    return client


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """In-memory SQLite session for repository and model tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as session:
        try:
            yield session
        finally:
            await session.rollback()
    await engine.dispose()
