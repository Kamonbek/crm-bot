from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import MaterialKind, ParseMode


class MaterialCreate(BaseModel):
    name: str
    kind: MaterialKind
    body: str | None = None
    file_id: str | None = None
    file_url: str | None = None
    link_url: str | None = None
    parse_mode: ParseMode = ParseMode.MARKDOWN_V2
    disable_web_page_preview: bool = False


class MaterialUpdate(BaseModel):
    name: str | None = None
    kind: MaterialKind | None = None
    body: str | None = None
    file_id: str | None = None
    file_url: str | None = None
    link_url: str | None = None
    parse_mode: ParseMode | None = None
    disable_web_page_preview: bool | None = None


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    kind: MaterialKind
    body: str | None
    file_id: str | None
    file_url: str | None
    link_url: str | None
    parse_mode: ParseMode
    disable_web_page_preview: bool
    created_at: datetime
    updated_at: datetime
