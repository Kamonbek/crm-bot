from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.broadcast import Broadcast, BroadcastStatus
from app.models.campaign import Campaign
from app.models.enums import ScheduledMessageStatus
from app.models.material import Material
from app.models.scheduled_message import ScheduledMessage
from app.models.sequence import Sequence
from app.models.user import User
from app.schemas.stats import (
    BroadcastStats,
    CampaignStats,
    ScheduledStats,
    SequenceStats,
    SimpleCount,
    StatsOut,
    UserStats,
)


async def get_dashboard_stats(session: AsyncSession) -> StatsOut:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    async def _count(stmt) -> int:
        return (await session.scalar(stmt)) or 0

    total_users = await _count(select(func.count()).select_from(User))
    new_today = await _count(
        select(func.count()).select_from(User).where(User.created_at >= today)
    )
    active_7d = await _count(
        select(func.count()).select_from(User).where(User.last_seen_at >= week_ago)
    )
    total_campaigns = await _count(select(func.count()).select_from(Campaign))
    active_campaigns = await _count(
        select(func.count()).select_from(Campaign).where(Campaign.is_active.is_(True))
    )
    total_materials = await _count(select(func.count()).select_from(Material))
    total_sequences = await _count(select(func.count()).select_from(Sequence))
    active_sequences = await _count(
        select(func.count()).select_from(Sequence).where(Sequence.is_active.is_(True))
    )
    total_broadcasts = await _count(select(func.count()).select_from(Broadcast))
    sent_broadcasts = await _count(
        select(func.count())
        .select_from(Broadcast)
        .where(Broadcast.status == BroadcastStatus.SENT)
    )
    pending_scheduled = await _count(
        select(func.count())
        .select_from(ScheduledMessage)
        .where(ScheduledMessage.status == ScheduledMessageStatus.PENDING)
    )

    return StatsOut(
        users=UserStats(total=total_users, new_today=new_today, active_7d=active_7d),
        campaigns=CampaignStats(total=total_campaigns, active=active_campaigns),
        materials=SimpleCount(total=total_materials),
        sequences=SequenceStats(total=total_sequences, active=active_sequences),
        broadcasts=BroadcastStats(total=total_broadcasts, sent=sent_broadcasts),
        scheduled=ScheduledStats(pending=pending_scheduled),
    )
