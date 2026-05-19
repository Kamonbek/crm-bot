from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.repositories import users as user_repo
from app.schemas.user import UserOut

router = APIRouter()


@router.get("", response_model=list[UserOut])
async def list_users(
    limit: int = 50,
    offset: int = 0,
    session: AsyncSession = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[UserOut]:
    items = await user_repo.list_users(session, limit=limit, offset=offset)
    return [UserOut.model_validate(u) for u in items]
