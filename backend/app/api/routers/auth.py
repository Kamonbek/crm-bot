from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin, get_db
from app.core.security import create_access_token, verify_password
from app.models.admin_user import AdminUser
from app.repositories import admin_users as admin_repo
from app.schemas.auth import AdminOut, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    admin = await admin_repo.get_by_email(session, body.email)
    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    admin.last_login_at = datetime.now(timezone.utc)
    token = create_access_token(subject=admin.email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=AdminOut)
async def me(current_admin: AdminUser = Depends(get_current_admin)) -> AdminOut:
    return AdminOut.model_validate(current_admin)
