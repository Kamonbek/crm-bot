from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.repositories import sequences as seq_repo
from app.schemas.sequence import (
    SequenceCreate,
    SequenceOut,
    SequenceStepCreate,
    SequenceStepOut,
    SequenceUpdate,
)

router = APIRouter()


@router.get("", response_model=list[SequenceOut])
async def list_sequences(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[SequenceOut]:
    items = await seq_repo.list_sequences(session)
    return [SequenceOut.model_validate(s) for s in items]


@router.post("", response_model=SequenceOut, status_code=status.HTTP_201_CREATED)
async def create_sequence(
    body: SequenceCreate,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> SequenceOut:
    seq = await seq_repo.create(session, **body.model_dump())
    return SequenceOut.model_validate(seq)


@router.get("/{sequence_id}", response_model=SequenceOut)
async def get_sequence(
    sequence_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> SequenceOut:
    seq = await seq_repo.get_by_id(session, sequence_id)
    if not seq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sequence not found")
    return SequenceOut.model_validate(seq)


@router.patch("/{sequence_id}", response_model=SequenceOut)
async def update_sequence(
    sequence_id: UUID,
    body: SequenceUpdate,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> SequenceOut:
    seq = await seq_repo.get_by_id(session, sequence_id)
    if not seq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sequence not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(seq, field, value)
    await session.flush()
    await session.refresh(seq)
    return SequenceOut.model_validate(seq)


@router.get("/{sequence_id}/steps", response_model=list[SequenceStepOut])
async def list_steps(
    sequence_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[SequenceStepOut]:
    if not await seq_repo.get_by_id(session, sequence_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sequence not found")
    steps = await seq_repo.list_steps(session, sequence_id)
    return [SequenceStepOut.model_validate(s) for s in steps]


@router.post(
    "/{sequence_id}/steps",
    response_model=SequenceStepOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_step(
    sequence_id: UUID,
    body: SequenceStepCreate,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> SequenceStepOut:
    if not await seq_repo.get_by_id(session, sequence_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sequence not found")
    step = await seq_repo.add_step(
        session,
        sequence_id=sequence_id,
        position=body.position,
        delay_minutes=body.delay_minutes,
        material_id=body.material_id,
    )
    return SequenceStepOut.model_validate(step)
