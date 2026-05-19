from __future__ import annotations

from pydantic import BaseModel


class UserStats(BaseModel):
    total: int
    new_today: int
    active_7d: int


class CampaignStats(BaseModel):
    total: int
    active: int


class SimpleCount(BaseModel):
    total: int


class SequenceStats(BaseModel):
    total: int
    active: int


class BroadcastStats(BaseModel):
    total: int
    sent: int


class ScheduledStats(BaseModel):
    pending: int


class StatsOut(BaseModel):
    users: UserStats
    campaigns: CampaignStats
    materials: SimpleCount
    sequences: SequenceStats
    broadcasts: BroadcastStats
    scheduled: ScheduledStats
