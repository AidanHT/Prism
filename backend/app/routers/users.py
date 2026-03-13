"""Users microservice router – profile management and user search.

Provides:
- ``GET /users/me``         → current user's profile
- ``PATCH /users/me``       → update display name, bio, timezone, avatar
- ``GET /users/search``     → autocomplete search for message recipients
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.base import AppBaseModel

router = APIRouter(tags=["users"])


# ── Inline schemas (profile-specific, not shared with other domains) ──────────


class UserSearchResult(AppBaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: str
    avatar_url: str | None


class UserMeResponse(AppBaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: str
    avatar_url: str | None
    bio: str | None
    timezone: str
    created_at: datetime
    updated_at: datetime


class UserPatch(AppBaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    bio: str | None = Field(None, max_length=2000)
    timezone: str | None = Field(None, max_length=64)
    avatar_url: str | None = Field(None, max_length=2048)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/users/me", response_model=UserMeResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return the authenticated user's profile."""
    return current_user


@router.patch("/users/me", response_model=UserMeResponse)
async def patch_me(
    payload: UserPatch,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Update the authenticated user's profile fields."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.get("/users/search", response_model=list[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=1, description="Name or email prefix"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[User]:
    """Full-text prefix search over name and email for compose autocomplete."""
    like = f"%{q}%"
    result = await db.execute(
        select(User)
        .where(
            (User.name.ilike(like)) | (User.email.ilike(like)),
            User.id != current_user.id,
        )
        .limit(10)
    )
    return list(result.scalars().all())
