"""Grading microservice router.

Handles AI-assisted assignment grading via the LangGraph evaluation pipeline.

POST /grading/evaluate – Run the full extraction → evaluation → validation
                         pipeline for a given submission and rubric.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func

from app.api.dependencies import get_current_user, get_db
from app.models.assignment import Submission
from app.models.grade import Grade
from app.models.rubric import Rubric
from app.models.user import User
from app.schemas.grading import EvaluateRequest, EvaluateResponse, GradeSaveRequest
from app.services.grading_pipeline import (
    format_rubric_for_evaluation,
    run_grading_pipeline,
)

router = APIRouter(prefix="/grading", tags=["grading"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "grading"}


@router.post(
    "/evaluate",
    response_model=EvaluateResponse,
    status_code=status.HTTP_200_OK,
    summary="Run AI grading evaluation for a student submission",
)
async def evaluate_submission(
    body: EvaluateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> EvaluateResponse:
    """Evaluate a student submission against a rubric using the LangGraph pipeline.

    Fetches the ``Submission`` and ``Rubric`` rows from PostgreSQL, runs the
    three-stage AI pipeline (extraction → Bedrock evaluation → Pydantic
    validation), and returns a structured score with per-criterion breakdown
    and constructive feedback.

    Error handling:
    - 404 if the submission or rubric does not exist.
    - 422 if the submission has no content (no file and no body).
    - 422 if the PDF/image is unreadable (Textract failure).
    - 503 if Bedrock is throttling requests.
    - 502 for any other unexpected pipeline failure.
    """
    submission = await _get_submission(db, body.submission_id)
    rubric = await _get_rubric(db, body.rubric_id)

    rubric_text = format_rubric_for_evaluation(rubric)

    state = await run_grading_pipeline(
        submission_file_url=submission.file_url,
        submission_body=submission.body,
        rubric_text=rubric_text,
    )

    if state["errors"]:
        _raise_pipeline_error(state["errors"])

    evaluation = state["evaluation_result"]
    if evaluation is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Pipeline completed but produced no evaluation result.",
        )

    return EvaluateResponse(
        submission_id=body.submission_id,
        rubric_id=body.rubric_id,
        evaluation=evaluation,
    )


# ── Save with anomaly detection ───────────────────────────────────────────────

_ANOMALY_THRESHOLD = 0.15


def check_grade_anomaly(
    proposed_score: float,
    ai_score: float | None,
    class_average: float | None,
    max_score: float,
    threshold: float = _ANOMALY_THRESHOLD,
) -> bool:
    """Return True when the proposed grade deviates beyond *threshold* from the
    AI baseline or the class average (both expressed as fractions of max_score).
    """
    if max_score <= 0:
        return False
    proposed_pct = proposed_score / max_score
    if class_average is not None and abs(proposed_pct - class_average) > threshold:
        return True
    if ai_score is not None:
        ai_pct = ai_score / max_score
        if abs(proposed_pct - ai_pct) > threshold:
            return True
    return False


@router.post(
    "/save",
    status_code=status.HTTP_200_OK,
    summary="Save a grade with anomaly detection",
)
async def save_grade(
    body: GradeSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Persist the grader's score and feedback.

    If the score deviates significantly from the class average or the AI
    suggestion, return a **409 Conflict** with ``anomaly_flagged: true``
    instead of saving, forcing the frontend to confirm.

    The frontend may re-submit with ``?force=true`` to bypass the check.
    """
    result = await db.execute(select(Grade).where(Grade.id == body.grade_id))
    grade = result.scalar_one_or_none()
    if grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found.")

    # Compute class average for same assignment (excluding this grade).
    class_avg: float | None = None
    if grade.assignment_id is not None and grade.max_score > 0:
        avg_result = await db.execute(
            select(func.avg(Grade.score / Grade.max_score)).where(
                Grade.assignment_id == grade.assignment_id,
                Grade.id != grade.id,
                Grade.max_score > 0,
            )
        )
        class_avg = avg_result.scalar_one_or_none()

    anomaly = check_grade_anomaly(
        proposed_score=body.score,
        ai_score=body.ai_suggested_score,
        class_average=class_avg,
        max_score=grade.max_score,
    )

    if anomaly:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "anomaly_flagged": True,
                "message": (
                    "This grade deviates significantly from the class average "
                    "and/or AI suggestion. Please confirm before saving."
                ),
            },
        )

    # No anomaly — persist.
    grade.score = body.score
    if body.feedback is not None:
        grade.feedback = body.feedback
    if body.grader_id is not None:
        grade.grader_id = body.grader_id
    await db.flush()
    await db.refresh(grade)

    return {
        "id": str(grade.id),
        "score": grade.score,
        "max_score": grade.max_score,
        "feedback": grade.feedback,
        "anomaly_flagged": False,
    }


# ── Private helpers ───────────────────────────────────────────────────────────


async def _get_submission(db: AsyncSession, submission_id: UUID) -> Submission:
    result = await db.execute(
        select(Submission).where(Submission.id == submission_id)
    )
    submission = result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission {submission_id} not found.",
        )
    return submission


async def _get_rubric(db: AsyncSession, rubric_id: UUID) -> Rubric:
    result = await db.execute(select(Rubric).where(Rubric.id == rubric_id))
    rubric = result.scalar_one_or_none()
    if rubric is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rubric {rubric_id} not found.",
        )
    return rubric


def _raise_pipeline_error(errors: list[str]) -> None:
    """Map pipeline error messages to appropriate HTTP status codes."""
    combined = " | ".join(errors)

    if "throttled" in combined.lower() or "throttling" in combined.lower():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Bedrock is currently throttling requests: {combined}",
        )
    if "extraction failed" in combined.lower() or "unreadable" in combined.lower():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from the submission file: {combined}",
        )
    if "no submission content" in combined.lower():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=combined,
        )
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Grading pipeline error: {combined}",
    )
