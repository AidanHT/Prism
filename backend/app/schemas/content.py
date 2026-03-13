"""Pydantic v2 schemas for Announcement, Page, and CourseFile."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.base import AppBaseModel


# ── Announcement ─────────────────────────────────────────────────────────────

class AnnouncementBase(AppBaseModel):
    course_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    author_id: UUID
    is_published: bool = False


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    body: str | None = Field(None, min_length=1)
    is_published: bool | None = None


class AnnouncementResponse(AnnouncementBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── Page ─────────────────────────────────────────────────────────────────────

class PageBase(AppBaseModel):
    course_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255, pattern=r"^[a-z0-9-]+$")
    body: str = Field(..., min_length=1)
    author_id: UUID
    is_published: bool = False


class PageCreate(PageBase):
    pass


class PageUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    slug: str | None = Field(None, min_length=1, max_length=255, pattern=r"^[a-z0-9-]+$")
    body: str | None = Field(None, min_length=1)
    is_published: bool | None = None


class PageResponse(PageBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── CourseFile ───────────────────────────────────────────────────────────────

class CourseFileBase(AppBaseModel):
    course_id: UUID
    folder_path: str = Field("/", max_length=1024)
    filename: str = Field(..., min_length=1, max_length=255)
    s3_key: str = Field(..., max_length=1024)
    content_type: str = Field(..., max_length=255)
    size_bytes: int = Field(..., gt=0)
    uploaded_by_id: UUID


class CourseFileCreate(CourseFileBase):
    pass


class CourseFileUpdate(AppBaseModel):
    folder_path: str | None = Field(None, max_length=1024)
    filename: str | None = Field(None, min_length=1, max_length=255)


class CourseFileResponse(CourseFileBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
