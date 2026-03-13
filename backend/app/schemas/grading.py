"""Pydantic v2 schemas for the AI grading evaluation pipeline."""
from __future__ import annotations

from uuid import UUID

from pydantic import Field

from app.schemas.base import AppBaseModel


class CriterionScore(AppBaseModel):
    """Score awarded to a single rubric criterion."""

    criterion_id: str = Field(..., description="UUID of the rubric criterion.")
    score: float = Field(..., ge=0.0, description="Points awarded for this criterion.")


class EvaluationResult(AppBaseModel):
    """Validated output from the Bedrock grading model.

    All three fields are required; the Pydantic validator in the pipeline
    will reject LLM responses that are missing any of them.
    """

    suggested_total_score: float = Field(
        ...,
        ge=0.0,
        description="Sum of all criterion scores suggested by the model.",
    )
    criterion_breakdown: list[CriterionScore] = Field(
        ...,
        min_length=1,
        description="Per-criterion scores referencing rubric criterion UUIDs.",
    )
    constructive_feedback: str = Field(
        ...,
        min_length=1,
        description="Encouraging, specific feedback addressed to the student.",
    )


class GradeSaveRequest(AppBaseModel):
    """Request body for POST /grading/save."""

    grade_id: UUID = Field(..., description="ID of the existing Grade row to update.")
    score: float = Field(..., ge=0.0, description="Score awarded by the grader.")
    feedback: str | None = Field(None, description="Optional HTML feedback for the student.")
    ai_suggested_score: float | None = Field(
        None, ge=0.0, description="AI-suggested score for anomaly comparison."
    )
    grader_id: UUID | None = Field(None, description="UUID of the grading user.")


class EvaluateRequest(AppBaseModel):
    """Request body for POST /grading/evaluate."""

    submission_id: UUID = Field(..., description="ID of the Submission row to grade.")
    rubric_id: UUID = Field(..., description="ID of the Rubric to evaluate against.")


class EvaluateResponse(AppBaseModel):
    """Response body for POST /grading/evaluate."""

    submission_id: UUID
    rubric_id: UUID
    evaluation: EvaluationResult
