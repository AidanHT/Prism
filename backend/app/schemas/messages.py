"""Pydantic v2 schemas for Message and MessageRecipient."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.base import AppBaseModel


# ── MessageRecipient ─────────────────────────────────────────────────────────

class MessageRecipientBase(AppBaseModel):
    message_id: UUID
    recipient_id: UUID
    read_at: datetime | None = None


class MessageRecipientCreate(AppBaseModel):
    """Used when specifying a single recipient during message creation."""

    recipient_id: UUID


class MessageRecipientUpdate(AppBaseModel):
    read_at: datetime | None = None


class MessageRecipientResponse(MessageRecipientBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── Message ──────────────────────────────────────────────────────────────────

class MessageBase(AppBaseModel):
    sender_id: UUID
    subject: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    course_id: UUID | None = None


class MessageCreate(AppBaseModel):
    """Create includes recipient_ids; sender_id is inferred from the auth context."""

    subject: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    course_id: UUID | None = None
    recipient_ids: list[UUID] = Field(..., min_length=1)


class MessageUpdate(AppBaseModel):
    subject: str | None = Field(None, min_length=1, max_length=255)
    body: str | None = Field(None, min_length=1)


class MessageResponse(MessageBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    recipients: list[MessageRecipientResponse] = []
    created_at: datetime
    updated_at: datetime
