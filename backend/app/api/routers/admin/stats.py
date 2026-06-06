from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.schemas.stats import StatsOut
import app.services.stats as stats_service

router = APIRouter()


@router.get("/stats", response_model=StatsOut)
async def get_stats(
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> StatsOut:
    return await stats_service.get_dashboard_stats(session)
