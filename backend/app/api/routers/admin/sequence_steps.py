from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.repositories import sequences as seq_repo
from app.schemas.sequence import SequenceStepOut, SequenceStepUpdate

router = APIRouter()


@router.patch("/{step_id}", response_model=SequenceStepOut)
async def update_step(
    step_id: UUID,
    body: SequenceStepUpdate,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> SequenceStepOut:
    step = await seq_repo.get_step_by_id(session, step_id)
    if not step:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(step, field, value)
    await session.flush()
    await session.refresh(step)
    return SequenceStepOut.model_validate(step)


@router.delete("/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_step(
    step_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> None:
    step = await seq_repo.get_step_by_id(session, step_id)
    if not step:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")
    await session.delete(step)
