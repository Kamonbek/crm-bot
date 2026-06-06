from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.broadcast import (
    Broadcast,
    BroadcastDelivery,
    BroadcastDeliveryStatus,
    BroadcastStatus,
)


async def get_by_id(session: AsyncSession, broadcast_id: uuid.UUID) -> Broadcast | None:
    return await session.get(Broadcast, broadcast_id)


async def count_recipients(
    session: AsyncSession, segment_id: uuid.UUID | None
) -> int:
    from sqlalchemy import func

    from app.models.segment import UserSegment
    from app.models.user import User

    if segment_id is None:
        return (
            await session.scalar(
                select(func.count()).select_from(User).where(User.is_blocked.is_(False))
            )
        ) or 0
    return (
        await session.scalar(
            select(func.count())
            .select_from(UserSegment)
            .join(User, User.id == UserSegment.user_id)
            .where(
                UserSegment.segment_id == segment_id,
                User.is_blocked.is_(False),
            )
        )
    ) or 0


async def create(
    session: AsyncSession,
    *,
    name: str,
    material_id: uuid.UUID,
    segment_id: uuid.UUID | None = None,
    scheduled_at: datetime | None = None,
    created_by: uuid.UUID | None = None,
) -> Broadcast:
    bc = Broadcast(
        name=name,
        material_id=material_id,
        segment_id=segment_id,
        scheduled_at=scheduled_at,
        created_by=created_by,
    )
    session.add(bc)
    await session.flush()
    return bc


async def set_status(
    session: AsyncSession, bc: Broadcast, status: BroadcastStatus
) -> None:
    bc.status = status
    await session.flush()


async def list_broadcasts(
    session: AsyncSession, *, status: BroadcastStatus | None = None
) -> Sequence[Broadcast]:
    stmt = select(Broadcast).order_by(Broadcast.created_at.desc())
    if status is not None:
        stmt = stmt.where(Broadcast.status == status)
    return (await session.execute(stmt)).scalars().all()


async def add_delivery(
    session: AsyncSession,
    *,
    broadcast_id: uuid.UUID,
    user_id: uuid.UUID,
    status: BroadcastDeliveryStatus = BroadcastDeliveryStatus.PENDING,
) -> BroadcastDelivery:
    delivery = BroadcastDelivery(
        broadcast_id=broadcast_id, user_id=user_id, status=status
    )
    session.add(delivery)
    await session.flush()
    return delivery


async def list_deliveries(
    session: AsyncSession, broadcast_id: uuid.UUID
) -> Sequence[BroadcastDelivery]:
    stmt = select(BroadcastDelivery).where(
        BroadcastDelivery.broadcast_id == broadcast_id
    )
    return (await session.execute(stmt)).scalars().all()
