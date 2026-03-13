"""Pydantic v2 schemas for User."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.base import AppBaseModel


class UserBase(AppBaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    role: UserRole
    avatar_url: str | None = Field(None, max_length=2048)
    bio: str | None = None
    timezone: str = Field("UTC", max_length=64)


class UserCreate(UserBase):
    """Requires a plain-text password; hashing is handled by the service layer."""

    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(AppBaseModel):
    email: EmailStr | None = None
    name: str | None = Field(None, min_length=1, max_length=255)
    role: UserRole | None = None
    avatar_url: str | None = Field(None, max_length=2048)
    bio: str | None = None
    timezone: str | None = Field(None, max_length=64)
    password: str | None = Field(None, min_length=8, max_length=128)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
