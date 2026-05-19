from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    telegram_id: int
    chat_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    language_code: str | None
    is_blocked: bool
    source_campaign_id: UUID | None
    last_seen_at: datetime | None
    created_at: datetime
    updated_at: datetime
