"""Pydantic v2 schemas for Quiz, QuizQuestion, and QuizAttempt."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Self
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator, model_validator

from app.models.enums import QuestionType
from app.schemas.base import AppBaseModel


# ── Quiz ─────────────────────────────────────────────────────────────────────

class QuizBase(AppBaseModel):
    course_id: UUID
    title: str = Field(..., min_length=1)
    description: str | None = None
    time_limit_minutes: int | None = Field(None, gt=0)
    attempt_limit: int | None = Field(None, gt=0)
    points_possible: float = Field(0.0, ge=0.0)
    is_published: bool = False
    available_from: datetime | None = None
    available_until: datetime | None = None


class QuizCreate(QuizBase):
    @field_validator("available_from", "available_until", mode="after")
    @classmethod
    def availability_must_be_future(cls, v: datetime | None) -> datetime | None:
        if v is not None:
            now = datetime.now(tz=timezone.utc)
            v_aware = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
            if v_aware <= now:
                raise ValueError("availability date must be in the future")
        return v

    @model_validator(mode="after")
    def available_until_after_from(self) -> Self:
        if self.available_from and self.available_until:
            frm = self.available_from if self.available_from.tzinfo else self.available_from.replace(tzinfo=timezone.utc)
            until = self.available_until if self.available_until.tzinfo else self.available_until.replace(tzinfo=timezone.utc)
            if until <= frm:
                raise ValueError("available_until must be after available_from")
        return self


class QuizUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1)
    description: str | None = None
    time_limit_minutes: int | None = Field(None, gt=0)
    attempt_limit: int | None = Field(None, gt=0)
    points_possible: float | None = Field(None, ge=0.0)
    is_published: bool | None = None
    available_from: datetime | None = None
    available_until: datetime | None = None


class QuizResponse(QuizBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── QuizQuestion ─────────────────────────────────────────────────────────────

class QuizQuestionBase(AppBaseModel):
    quiz_id: UUID
    question_type: QuestionType
    question_text: str = Field(..., min_length=1)
    points: float = Field(1.0, gt=0.0)
    position: int = Field(0, ge=0)
    # For MC/true_false: {"choices": ["opt1", "opt2", ...]}
    # For matching: {"pairs": [{"left": "...", "right": "..."}, ...]}
    # Null for short_answer/essay.
    options: dict[str, object] | None = None
    correct_answer: str | None = None


class QuizQuestionCreate(QuizQuestionBase):
    @model_validator(mode="after")
    def validate_correct_answer_in_options(self) -> Self:
        objective_types = (QuestionType.multiple_choice, QuestionType.true_false)
        if self.question_type in objective_types:
            if not self.options:
                raise ValueError(
                    f"options are required for {self.question_type.value} questions"
                )
            choices = self.options.get("choices")
            if not isinstance(choices, list):
                raise ValueError("options must contain a 'choices' list")
            if self.correct_answer not in choices:
                raise ValueError(
                    "correct_answer must match one of the values in options.choices"
                )
        return self


class QuizQuestionUpdate(AppBaseModel):
    question_type: QuestionType | None = None
    question_text: str | None = Field(None, min_length=1)
    points: float | None = Field(None, gt=0.0)
    position: int | None = Field(None, ge=0)
    options: dict[str, object] | None = None
    correct_answer: str | None = None


class QuizQuestionResponse(QuizQuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


# ── QuizAttempt ───────────────────────────────────────────────────────────────

class QuizAttemptBase(AppBaseModel):
    quiz_id: UUID
    student_id: UUID
    started_at: datetime
    submitted_at: datetime | None = None
    score: float | None = None
    # Maps question_id (str) -> student's answer value.
    answers: dict[str, object] = {}


class QuizAttemptCreate(QuizAttemptBase):
    pass


class QuizAttemptUpdate(AppBaseModel):
    submitted_at: datetime | None = None
    score: float | None = Field(None, ge=0.0)
    answers: dict[str, object] | None = None


class QuizAttemptResponse(QuizAttemptBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
