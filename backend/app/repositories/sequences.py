from __future__ import annotations

import uuid
from collections.abc import Sequence as Seq

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SequenceTriggerKind
from app.models.sequence import Sequence, SequenceStep


async def get_by_id(session: AsyncSession, sequence_id: uuid.UUID) -> Sequence | None:
    return await session.get(Sequence, sequence_id)


async def list_sequences(session: AsyncSession) -> Seq[Sequence]:
    stmt = select(Sequence).order_by(Sequence.created_at.desc())
    return (await session.execute(stmt)).scalars().all()


async def create(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
    trigger_kind: SequenceTriggerKind = SequenceTriggerKind.MANUAL,
    is_active: bool = True,
) -> Sequence:
    seq = Sequence(
        name=name,
        description=description,
        trigger_kind=trigger_kind,
        is_active=is_active,
    )
    session.add(seq)
    await session.flush()
    return seq


async def get_step_by_id(
    session: AsyncSession, step_id: uuid.UUID
) -> SequenceStep | None:
    return await session.get(SequenceStep, step_id)


async def add_step(
    session: AsyncSession,
    *,
    sequence_id: uuid.UUID,
    position: int,
    delay_minutes: int,
    material_id: uuid.UUID,
) -> SequenceStep:
    step = SequenceStep(
        sequence_id=sequence_id,
        position=position,
        delay_minutes=delay_minutes,
        material_id=material_id,
    )
    session.add(step)
    await session.flush()
    return step


async def list_steps(
    session: AsyncSession, sequence_id: uuid.UUID
) -> Seq[SequenceStep]:
    stmt = (
        select(SequenceStep)
        .where(SequenceStep.sequence_id == sequence_id)
        .order_by(SequenceStep.position)
    )
    return (await session.execute(stmt)).scalars().all()
