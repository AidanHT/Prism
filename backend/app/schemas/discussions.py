"""Pydantic v2 schemas for Discussion and DiscussionReply."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.base import AppBaseModel


# ── Discussion ───────────────────────────────────────────────────────────────

class DiscussionBase(AppBaseModel):
    course_id: UUID
    title: str = Field(..., min_length=1)
    body: str = Field(..., min_length=1)
    author_id: UUID
    is_pinned: bool = False
    is_locked: bool = False


class DiscussionCreate(DiscussionBase):
    pass


class DiscussionUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1)
    body: str | None = Field(None, min_length=1)
    is_pinned: bool | None = None
    is_locked: bool | None = None


class DiscussionResponse(DiscussionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── DiscussionReply ──────────────────────────────────────────────────────────

class DiscussionReplyBase(AppBaseModel):
    discussion_id: UUID
    author_id: UUID
    body: str = Field(..., min_length=1)
    parent_reply_id: UUID | None = None


class DiscussionReplyCreate(DiscussionReplyBase):
    pass


class DiscussionReplyUpdate(AppBaseModel):
    body: str | None = Field(None, min_length=1)


class DiscussionReplyResponse(DiscussionReplyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
