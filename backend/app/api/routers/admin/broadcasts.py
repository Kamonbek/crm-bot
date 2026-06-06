from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.models.broadcast import BroadcastStatus
from app.repositories import broadcasts as broadcast_repo
from app.schemas.broadcast import (
    BroadcastCreate,
    BroadcastOut,
    BroadcastPreviewOut,
    BroadcastPreviewRequest,
    BroadcastSendRequest,
)

router = APIRouter()


@router.post("/preview", response_model=BroadcastPreviewOut)
async def preview_broadcast(
    body: BroadcastPreviewRequest,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> BroadcastPreviewOut:
    count = await broadcast_repo.count_recipients(session, body.segment_id)
    return BroadcastPreviewOut(recipient_count=count)


@router.post("", response_model=BroadcastOut, status_code=status.HTTP_201_CREATED)
async def create_broadcast(
    body: BroadcastCreate,
    session: AsyncSession = Depends(get_db),
    current_admin: AdminUser = Depends(get_current_admin),
) -> BroadcastOut:
    bc = await broadcast_repo.create(
        session,
        name=body.name,
        material_id=body.material_id,
        segment_id=body.segment_id,
        scheduled_at=body.scheduled_at,
        created_by=current_admin.id,
    )
    return BroadcastOut.model_validate(bc)


@router.post("/{broadcast_id}/send", response_model=BroadcastOut)
async def schedule_broadcast(
    broadcast_id: UUID,
    body: BroadcastSendRequest,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> BroadcastOut:
    bc = await broadcast_repo.get_by_id(session, broadcast_id)
    if not bc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Broadcast not found")
    if bc.status != BroadcastStatus.DRAFT:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot send a broadcast in status '{bc.status.value}'",
        )
    if body.scheduled_at is not None:
        bc.scheduled_at = body.scheduled_at
    await broadcast_repo.set_status(session, bc, BroadcastStatus.SCHEDULED)
    return BroadcastOut.model_validate(bc)


@router.get("", response_model=list[BroadcastOut])
async def list_broadcasts(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[BroadcastOut]:
    items = await broadcast_repo.list_broadcasts(session)
    return [BroadcastOut.model_validate(bc) for bc in items]


@router.get("/{broadcast_id}", response_model=BroadcastOut)
async def get_broadcast(
    broadcast_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> BroadcastOut:
    bc = await broadcast_repo.get_by_id(session, broadcast_id)
    if not bc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Broadcast not found")
    return BroadcastOut.model_validate(bc)
