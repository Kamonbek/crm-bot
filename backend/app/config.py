from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ENV: Literal["development", "staging", "production", "test"] = "development"
    LOG_LEVEL: str = "INFO"
    APP_NAME: str = "arabic-contact-bot"
    APP_VERSION: str = "0.1.0"

    HOST: str = "0.0.0.0"
    PORT: int = 8080

    # ------------------------------------------------------------------ #
    # Database
    # Production: Supabase Supavisor transaction-pooler URL on port 6543.
    # Format: postgresql+asyncpg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
    # ------------------------------------------------------------------ #
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/arabic_bot",
        description="Async SQLAlchemy URL. Use asyncpg for Postgres, aiosqlite for local tests.",
    )
    DB_ECHO: bool = False
    # Conservative pool sizing for Cloud Run (stateless, horizontally scaled).
    # Each instance holds at most pool_size + max_overflow = 5 connections by default.
    DB_POOL_SIZE: int = 2
    DB_MAX_OVERFLOW: int = 3
    DB_POOL_PRE_PING: bool = True
    # Recycle connections before Supabase / PgBouncer idle timeout (typically 5 min).
    DB_POOL_RECYCLE: int = 1800

    # ------------------------------------------------------------------ #
    # Telegram
    # ------------------------------------------------------------------ #
    TELEGRAM_BOT_TOKEN: str = Field(
        default="",
        description="Bot token from BotFather. Required in production.",
    )
    # Random secret appended to the webhook URL path for lightweight auth.
    TELEGRAM_WEBHOOK_SECRET: str = Field(
        default="",
        description="Secret token in the webhook URL path.",
    )

    # ------------------------------------------------------------------ #
    # JWT admin auth
    # ------------------------------------------------------------------ #
    JWT_SECRET: str = Field(
        default="change-me-in-production-must-be-at-least-32-chars!!",
        description="Secret key for signing JWTs. Must be ≥32 chars in production.",
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    FRONTEND_ORIGIN: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of allowed CORS origins.",
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def _ensure_async_driver(cls, v: str) -> str:
        # Supabase and most docs give plain postgresql:// URLs.
        # Silently upgrade to postgresql+asyncpg:// so copy-paste always works.
        if v.startswith("postgresql://") or v.startswith("postgres://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("LOG_LEVEL")
    @classmethod
    def _normalize_log_level(cls, v: str) -> str:
        return v.upper()

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
