from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.repositories import campaigns as campaign_repo
from app.schemas.campaign import CampaignCreate, CampaignOut, CampaignUpdate

router = APIRouter()


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(
    is_active: bool | None = None,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[CampaignOut]:
    items = await campaign_repo.list_campaigns(session, is_active=is_active)
    return [CampaignOut.model_validate(c) for c in items]


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> CampaignOut:
    if await campaign_repo.get_by_slug(session, body.slug):
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug already in use")
    campaign = await campaign_repo.create(
        session,
        name=body.name,
        slug=body.slug,
        description=body.description,
        is_active=body.is_active,
    )
    return CampaignOut.model_validate(campaign)


@router.get("/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> CampaignOut:
    campaign = await campaign_repo.get_by_id(session, campaign_id)
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return CampaignOut.model_validate(campaign)


@router.patch("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: UUID,
    body: CampaignUpdate,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> CampaignOut:
    campaign = await campaign_repo.get_by_id(session, campaign_id)
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if body.slug is not None and body.slug != campaign.slug:
        if await campaign_repo.get_by_slug(session, body.slug):
            raise HTTPException(status.HTTP_409_CONFLICT, "Slug already in use")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await session.flush()
    await session.refresh(campaign)
    return CampaignOut.model_validate(campaign)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: UUID,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> None:
    campaign = await campaign_repo.get_by_id(session, campaign_id)
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    await session.delete(campaign)
