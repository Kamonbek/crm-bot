from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import SequenceTriggerKind


class SequenceCreate(BaseModel):
    name: str
    description: str | None = None
    trigger_kind: SequenceTriggerKind = SequenceTriggerKind.MANUAL
    is_active: bool = True


class SequenceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_kind: SequenceTriggerKind | None = None
    is_active: bool | None = None


class SequenceStepCreate(BaseModel):
    position: int
    delay_minutes: int = 0
    material_id: UUID


class SequenceStepUpdate(BaseModel):
    position: int | None = None
    delay_minutes: int | None = None
    material_id: UUID | None = None


class SequenceStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sequence_id: UUID
    position: int
    delay_minutes: int
    material_id: UUID
    created_at: datetime
    updated_at: datetime


class SequenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    trigger_kind: SequenceTriggerKind
    is_active: bool
    created_at: datetime
    updated_at: datetime
