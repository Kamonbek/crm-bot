from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import health, version
from app.api.routers import auth as auth_router
from app.api.routers import dev as dev_router
from app.api.routers import internal as internal_router
from app.api.routers import telegram as telegram_router
from app.api.routers.admin import router as admin_router
from app.config import Settings, get_settings
from app.db.session import dispose_engine, get_engine
from app.logging import configure_logging, get_logger
from app.middleware import RequestIdMiddleware
from app.telegram.bot import close_bot, get_dispatcher


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(level=settings.LOG_LEVEL, app_name=settings.APP_NAME)
    log = get_logger(settings.APP_NAME)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        log.info("startup", extra={"env": settings.ENV, "version": settings.APP_VERSION})
        get_engine()
        get_dispatcher()  # initialise singleton eagerly
        try:
            yield
        finally:
            await close_bot()
            await dispose_engine()
            log.info("shutdown")

    app = FastAPI(
        title="Arabic Contact Bot API",
        version=settings.APP_VERSION,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    app.include_router(health.router)
    app.include_router(version.router)
    app.include_router(auth_router.router)
    if not settings.is_production:
        app.include_router(dev_router.router)
    app.include_router(admin_router)
    app.include_router(internal_router.router)
    app.include_router(telegram_router.router)

    return app


app = create_app()
