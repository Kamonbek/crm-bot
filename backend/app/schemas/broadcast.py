from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.broadcast import BroadcastStatus


class BroadcastCreate(BaseModel):
    name: str
    material_id: UUID
    segment_id: UUID | None = None
    scheduled_at: datetime | None = None


class BroadcastSendRequest(BaseModel):
    scheduled_at: datetime | None = None


class BroadcastPreviewRequest(BaseModel):
    segment_id: UUID | None = None


class BroadcastPreviewOut(BaseModel):
    recipient_count: int


class BroadcastOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    material_id: UUID
    segment_id: UUID | None
    status: BroadcastStatus
    scheduled_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    recipient_count: int
    success_count: int
    failure_count: int
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
