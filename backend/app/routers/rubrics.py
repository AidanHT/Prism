"""Rubric generation and calibration microservice router.

POST /rubrics/generate  – AI-powered rubric creation from assignment
                          instructions (Claude Opus 4.6 via Bedrock).
POST /rubrics/calibrate – Test a draft rubric against 2–3 sample student
                          submissions and surface calibration warnings.
"""
from __future__ import annotations

import asyncio
import json
import re
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.models.rubric import Rubric, RubricCriterion
from app.models.user import User
from app.schemas.rubrics import (
    CalibrationResponse,
    CalibrationWarning,
    GeneratedCriterion,
    GeneratedRating,
    RubricGenerateRequest,
    RubricGenerateResponse,
    RubricResponse,
)
from app.services.bedrock import invoke_model_complex
from app.services.textract import extract_text_from_bytes

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

# ── System prompts ────────────────────────────────────────────────────────────

_GENERATE_SYSTEM = """\
You are an expert curriculum designer and assessment specialist.
Your task is to generate a detailed grading rubric for a university assignment.

Respond ONLY with a valid JSON object matching this exact schema – no prose, no markdown fences:
{
  "title": "<rubric title>",
  "criteria": [
    {
      "description": "<criterion description>",
      "points": <max points as number>,
      "ratings": [
        {"description": "<performance level description>", "points": <points as number>},
        ...
      ]
    }
  ]
}

Rules:
- Generate 4–6 criteria that comprehensively cover the assignment goals.
- Each criterion must have exactly 4 rating levels ordered highest → lowest points.
  Label them roughly: Excellent, Proficient, Developing, Beginning.
- The highest rating's points must equal the criterion's max points.
- The lowest rating must be 0 pts.
- Be specific and measurable to minimise grader subjectivity.
- Ensure criterion points sum to a sensible total (100 pts is typical).
- Output ONLY the JSON object. No explanation, no markdown code fences.
"""

_CALIBRATE_SYSTEM = """\
You are an expert curriculum designer reviewing a grading rubric for consistency and fairness.
You have been given a rubric and 2–3 student submissions.

Apply the rubric to each submission and identify criteria that are:
  • Ambiguous in language (different graders would interpret them differently)
  • Leading to high grading variance across the sample submissions
  • Missing coverage for work that appears in the submissions

Respond ONLY with a valid JSON array – no prose, no markdown fences:
[
  {
    "criterion_description": "<exact criterion description from the rubric>",
    "warning_message": "<specific, actionable warning explaining the issue>",
    "variance_pct": <estimated grading variance as float 0–100, or null>
  }
]

If no calibration issues are found, return an empty array: []
Output ONLY the JSON array. No explanation, no markdown code fences.
"""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=list[RubricResponse],
    summary="List rubrics for a course",
)
async def list_rubrics(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Rubric]:
    """Return all rubrics belonging to a given course, with their criteria."""
    result = await db.execute(select(Rubric).where(Rubric.course_id == course_id))
    return list(result.scalars().all())


@router.post(
    "/generate",
    response_model=RubricGenerateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_rubric(
    body: RubricGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RubricGenerateResponse:
    """Generate an AI-powered rubric from assignment instructions.

    Invokes Claude Opus 4.6 via Amazon Bedrock and persists the result as a
    draft ``Rubric`` row in PostgreSQL so that the calibration endpoint can
    reference it by ID.
    """
    prompt = (
        f"Assignment Title: {body.assignment_title}\n\n"
        f"Instructions:\n{body.assignment_instructions}\n\n"
        "Generate a comprehensive grading rubric for this assignment."
    )

    raw: str = await asyncio.to_thread(
        invoke_model_complex,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        system=_GENERATE_SYSTEM,
        max_tokens=4096,
        temperature=0.4,
    )

    try:
        data: dict = json.loads(_extract_json_object(raw))
        title: str = data["title"]
        raw_criteria: list[dict] = data["criteria"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bedrock returned malformed JSON: {exc}",
        ) from exc

    # Persist as a draft rubric so calibration can look it up by ID.
    rubric = Rubric(course_id=body.course_id, title=title)
    db.add(rubric)
    await db.flush()  # populate rubric.id before adding children

    criteria_out: list[GeneratedCriterion] = []
    for pos, rc in enumerate(raw_criteria):
        raw_ratings: list[dict] = rc.get("ratings", [])
        ratings = [
            GeneratedRating(
                description=str(r.get("description", "")),
                points=float(r.get("points", 0)),
            )
            for r in raw_ratings
        ]
        # Store ratings as JSONB using the existing RatingItem shape.
        db_ratings = [
            {"id": f"{pos}-{i}", "description": r.description, "points": r.points}
            for i, r in enumerate(ratings)
        ]
        db.add(
            RubricCriterion(
                rubric_id=rubric.id,
                description=str(rc.get("description", "")),
                points=float(rc.get("points", 0)),
                position=pos,
                ratings=db_ratings,
            )
        )
        criteria_out.append(
            GeneratedCriterion(
                description=str(rc.get("description", "")),
                points=float(rc.get("points", 0)),
                ratings=ratings,
            )
        )

    await db.flush()
    return RubricGenerateResponse(rubric_id=rubric.id, title=title, criteria=criteria_out)


@router.post("/calibrate", response_model=CalibrationResponse)
async def calibrate_rubric(
    rubric_id: UUID = Form(...),
    samples: list[UploadFile] = File(
        ..., description="2–3 student submission files (PDF, TXT, etc.)"
    ),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CalibrationResponse:
    """Evaluate a draft rubric against sample submissions and return calibration warnings.

    Accepts 2–3 uploaded files.  Plain-text files are decoded directly;
    PDFs and images are processed via Amazon Textract.  The rubric and all
    parsed submissions are then passed to Claude Opus 4.6 which identifies
    criteria that are ambiguous or likely to produce high grading variance.
    """
    if not (2 <= len(samples) <= 3):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide between 2 and 3 sample submission files.",
        )

    result = await db.execute(select(Rubric).where(Rubric.id == rubric_id))
    rubric = result.scalar_one_or_none()
    if rubric is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rubric not found – run /rubrics/generate first.",
        )

    # Extract text from each uploaded sample (offload blocking I/O to thread).
    submission_texts: list[str] = []
    for upload in samples:
        file_bytes = await upload.read()
        text = await asyncio.to_thread(
            extract_text_from_bytes,
            file_bytes,
            content_type=upload.content_type or "application/octet-stream",
            filename=upload.filename or "",
        )
        submission_texts.append(text)

    rubric_block = _format_rubric_for_prompt(rubric)
    submissions_block = "\n\n".join(
        f"--- Submission {i + 1} ---\n{text}"
        for i, text in enumerate(submission_texts)
    )

    prompt = (
        f"Rubric:\n{rubric_block}\n\n"
        f"Student Submissions:\n{submissions_block}\n\n"
        "Identify any rubric criteria that lead to ambiguous or inconsistent grading."
    )

    raw: str = await asyncio.to_thread(
        invoke_model_complex,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        system=_CALIBRATE_SYSTEM,
        max_tokens=2048,
        temperature=0.3,
    )

    try:
        warnings_data: list[dict] = json.loads(_extract_json_array(raw))
        warnings = [
            CalibrationWarning(
                criterion_description=str(w.get("criterion_description", "")),
                warning_message=str(w.get("warning_message", "")),
                variance_pct=w.get("variance_pct"),
            )
            for w in warnings_data
        ]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Bedrock returned malformed JSON: {exc}",
        ) from exc

    return CalibrationResponse(rubric_id=rubric_id, calibration_warnings=warnings)


# ── Private helpers ───────────────────────────────────────────────────────────

def _extract_json_object(text: str) -> str:
    """Pull the first JSON object from a potentially noisy LLM response."""
    match = re.search(r"\{[\s\S]*\}", text)
    return match.group(0) if match else text.strip()


def _extract_json_array(text: str) -> str:
    """Pull the first JSON array from a potentially noisy LLM response."""
    match = re.search(r"\[[\s\S]*\]", text)
    return match.group(0) if match else text.strip()


def _format_rubric_for_prompt(rubric: Rubric) -> str:
    """Serialise a Rubric ORM object as readable text for a Bedrock prompt."""
    lines: list[str] = [f"Title: {rubric.title}"]
    for criterion in rubric.criteria:
        lines.append(
            f"\nCriterion: {criterion.description} (max {criterion.points} pts)"
        )
        for rating in criterion.ratings:
            lines.append(
                f"  - {rating.get('description', '')}: {rating.get('points', 0)} pts"
            )
    return "\n".join(lines)
