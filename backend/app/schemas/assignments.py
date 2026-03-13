"""Pydantic v2 schemas for Assignment and Submission."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Self
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.models.enums import SubmissionType
from app.schemas.base import AppBaseModel


# ── Assignment ───────────────────────────────────────────────────────────────

class AssignmentBase(AppBaseModel):
    course_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    points_possible: float = Field(0.0, ge=0.0)
    due_date: datetime | None = None
    lock_date: datetime | None = None
    submission_types: list[SubmissionType] = []
    is_published: bool = False


class AssignmentCreate(AssignmentBase):
    @field_validator("due_date", "lock_date", mode="after")
    @classmethod
    def dates_must_be_future(cls, v: datetime | None) -> datetime | None:
        if v is not None:
            now = datetime.now(tz=timezone.utc)
            v_aware = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
            if v_aware <= now:
                raise ValueError("date must be in the future")
        return v

    @model_validator(mode="after")
    def lock_date_not_before_due_date(self) -> Self:
        if self.due_date and self.lock_date:
            due = self.due_date if self.due_date.tzinfo else self.due_date.replace(tzinfo=timezone.utc)
            lock = self.lock_date if self.lock_date.tzinfo else self.lock_date.replace(tzinfo=timezone.utc)
            if lock < due:
                raise ValueError("lock_date must be on or after due_date")
        return self


class AssignmentUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    points_possible: float | None = Field(None, ge=0.0)
    due_date: datetime | None = None
    lock_date: datetime | None = None
    submission_types: list[SubmissionType] | None = None
    is_published: bool | None = None


class AssignmentResponse(AssignmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── Submission ───────────────────────────────────────────────────────────────

class SubmissionBase(AppBaseModel):
    assignment_id: UUID
    student_id: UUID
    submitted_at: datetime
    body: str | None = None
    file_url: str | None = Field(None, max_length=2048)


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(AppBaseModel):
    body: str | None = None
    file_url: str | None = Field(None, max_length=2048)
    grade: float | None = Field(None, ge=0.0)
    grader_id: UUID | None = None
    graded_at: datetime | None = None
    feedback: str | None = None


class SubmissionResponse(SubmissionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grade: float | None = None
    grader_id: UUID | None = None
    graded_at: datetime | None = None
    feedback: str | None = None
    created_at: datetime
    updated_at: datetime
