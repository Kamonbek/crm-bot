from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import Settings, get_settings


def build_engine(settings: Settings | None = None):
    settings = settings or get_settings()
    kwargs: dict = {"echo": settings.DB_ECHO, "future": True}
    # pool_size / max_overflow / pool_recycle only apply to QueuePool (Postgres).
    # The SQLite dialect uses StaticPool and rejects those kwargs.
    if not settings.DATABASE_URL.startswith("sqlite"):
        kwargs["pool_pre_ping"] = settings.DB_POOL_PRE_PING
        kwargs["pool_size"] = settings.DB_POOL_SIZE
        kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
        kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
        kwargs["connect_args"] = {"statement_cache_size": 0}
    return create_async_engine(settings.DATABASE_URL, **kwargs)


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine():
    global _engine, _session_factory
    if _engine is None:
        _engine = build_engine()
        _session_factory = async_sessionmaker(
            _engine, expire_on_commit=False, class_=AsyncSession
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        get_engine()
    assert _session_factory is not None
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
