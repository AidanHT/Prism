"""Pydantic v2 schemas for Notification."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.models.enums import NotificationType
from app.schemas.base import AppBaseModel


class NotificationBase(AppBaseModel):
    user_id: UUID
    type: NotificationType
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    is_read: bool = False
    link: str | None = Field(None, max_length=2048)


class NotificationCreate(NotificationBase):
    pass


class NotificationUpdate(AppBaseModel):
    is_read: bool | None = None


class NotificationResponse(NotificationBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
