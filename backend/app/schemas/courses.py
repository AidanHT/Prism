"""Pydantic v2 schemas for Course, Enrollment, Module, and ModuleItem."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.models.enums import EnrollmentRole, ModuleItemType
from app.schemas.base import AppBaseModel


# ── ModuleItem ──────────────────────────────────────────────────────────────

class ModuleItemBase(AppBaseModel):
    module_id: UUID
    item_type: ModuleItemType
    item_id: UUID
    position: int = Field(0, ge=0)
    is_published: bool = False


class ModuleItemCreate(ModuleItemBase):
    pass


class ModuleItemUpdate(AppBaseModel):
    item_type: ModuleItemType | None = None
    item_id: UUID | None = None
    position: int | None = Field(None, ge=0)
    is_published: bool | None = None


class ModuleItemResponse(ModuleItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── Module ───────────────────────────────────────────────────────────────────

class ModuleBase(AppBaseModel):
    course_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    position: int = Field(0, ge=0)
    is_published: bool = False


class ModuleCreate(ModuleBase):
    pass


class ModuleUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    position: int | None = Field(None, ge=0)
    is_published: bool | None = None


class ModuleResponse(ModuleBase):
    """Items are pre-sorted by position via ORM `order_by`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    items: list[ModuleItemResponse] = []
    created_at: datetime
    updated_at: datetime


# ── Enrollment ───────────────────────────────────────────────────────────────

class EnrollmentBase(AppBaseModel):
    user_id: UUID
    course_id: UUID
    role: EnrollmentRole


class EnrollmentCreate(EnrollmentBase):
    pass


class EnrollmentUpdate(AppBaseModel):
    role: EnrollmentRole | None = None


class EnrollmentResponse(EnrollmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    enrolled_at: datetime
    created_at: datetime
    updated_at: datetime


# ── Course ───────────────────────────────────────────────────────────────────

class CourseBase(AppBaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    description: str | None = None
    term: str | None = Field(None, max_length=50)
    instructor_id: UUID
    grading_scheme: dict[str, object] | None = None
    late_policy: dict[str, object] | None = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    code: str | None = Field(None, min_length=1, max_length=50)
    description: str | None = None
    term: str | None = Field(None, max_length=50)
    instructor_id: UUID | None = None
    grading_scheme: dict[str, object] | None = None
    late_policy: dict[str, object] | None = None


class CourseResponse(CourseBase):
    """Optionally includes the list of enrollments for roster views."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    enrollments: list[EnrollmentResponse] | None = None
    created_at: datetime
    updated_at: datetime
