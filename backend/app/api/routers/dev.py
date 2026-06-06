from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db

router = APIRouter(prefix="/dev", tags=["dev"])


@router.get("/db-check")
async def db_check(session: AsyncSession = Depends(get_db)) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"database": "ok"}
