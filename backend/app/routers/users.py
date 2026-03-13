"""Users microservice router -- profile management and user search.

Provides:
- ``GET /users/me``         -> current user's profile
- ``PATCH /users/me``       -> update display name, bio, timezone, avatar
- ``GET /users/search``     -> autocomplete search for message recipients

All persistence is backed by DynamoDB via ``dynamo_manager``.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import ConfigDict, Field

from app.api.dependencies import get_current_user
from app.db.dynamo import dynamo_manager
from app.schemas.base import AppBaseModel

router = APIRouter(tags=["users"])


# -- Inline schemas (profile-specific, not shared with other domains) ----------


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


# -- Endpoints -----------------------------------------------------------------


@router.get("/users/me", response_model=UserMeResponse)
async def get_me(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Return the authenticated user's profile."""
    return current_user


@router.patch("/users/me", response_model=UserMeResponse)
async def patch_me(
    payload: UserPatch,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Update the authenticated user's profile fields."""
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return current_user
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = await dynamo_manager.update_user(current_user["id"], updates)
    if updated is None:
        # Shouldn't happen for an authenticated user, but handle gracefully
        return current_user
    return updated


@router.get("/users/search", response_model=list[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=1, description="Name or email prefix"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Full-text prefix search over name and email for compose autocomplete."""
    results = await dynamo_manager.search_users(q, limit=10)
    # Exclude the current user from results
    return [u for u in results if u.get("id") != current_user["id"]]
