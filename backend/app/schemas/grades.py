"""Pydantic v2 schemas for Grade."""
from __future__ import annotations

from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import ConfigDict, Field, model_validator

from app.schemas.base import AppBaseModel


class GradeBase(AppBaseModel):
    enrollment_id: UUID
    # Exactly one of these must be non-null (mirroring the DB check constraint).
    assignment_id: UUID | None = None
    quiz_id: UUID | None = None
    score: float = Field(..., ge=0.0)
    max_score: float = Field(..., gt=0.0)
    grader_id: UUID | None = None
    feedback: str | None = None


class GradeCreate(GradeBase):
    @model_validator(mode="after")
    def exactly_one_gradeable(self) -> Self:
        if (self.assignment_id is None) == (self.quiz_id is None):
            raise ValueError(
                "Exactly one of assignment_id or quiz_id must be provided"
            )
        return self

    @model_validator(mode="after")
    def score_within_max(self) -> Self:
        if self.score > self.max_score:
            raise ValueError("score cannot exceed max_score")
        return self


class GradeUpdate(AppBaseModel):
    score: float | None = Field(None, ge=0.0)
    max_score: float | None = Field(None, gt=0.0)
    grader_id: UUID | None = None
    feedback: str | None = None
    # Optional AI-suggested score forwarded by the frontend for variance comparison.
    ai_suggested_score: float | None = Field(None, ge=0.0, exclude=True)


class GradeResponse(GradeBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class GradeWithAnomalyResponse(GradeResponse):
    """Extended response returned by the update endpoint with variance metadata."""

    anomaly_flag: bool = Field(
        False,
        description=(
            "True when the submitted score deviates >15 percentage points from "
            "the class average or the AI-suggested score."
        ),
    )
