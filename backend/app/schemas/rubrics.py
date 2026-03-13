"""Pydantic v2 schemas for Rubric and RubricCriterion."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.base import AppBaseModel


class RatingItem(AppBaseModel):
    """A single performance level within a rubric criterion."""

    id: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    points: float = Field(..., ge=0.0)


# ── RubricCriterion ──────────────────────────────────────────────────────────

class RubricCriterionBase(AppBaseModel):
    rubric_id: UUID
    description: str = Field(..., min_length=1)
    points: float = Field(..., gt=0.0)
    position: int = Field(0, ge=0)
    ratings: list[RatingItem] = []


class RubricCriterionCreate(RubricCriterionBase):
    pass


class RubricCriterionUpdate(AppBaseModel):
    description: str | None = Field(None, min_length=1)
    points: float | None = Field(None, gt=0.0)
    position: int | None = Field(None, ge=0)
    ratings: list[RatingItem] | None = None


class RubricCriterionResponse(RubricCriterionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── Rubric ───────────────────────────────────────────────────────────────────

class RubricBase(AppBaseModel):
    course_id: UUID
    title: str = Field(..., min_length=1, max_length=255)


class RubricCreate(RubricBase):
    pass


class RubricUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)


class RubricResponse(RubricBase):
    """Criteria are pre-sorted by position via ORM `order_by`."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    criteria: list[RubricCriterionResponse] = []
    created_at: datetime
    updated_at: datetime
