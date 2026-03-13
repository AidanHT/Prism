"""Assignments microservice router.

Handles assignment CRUD for courses and student submission flow, supporting
both text (JSON body) and file (S3 URL) submission types.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Self
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.models.assignment import Assignment, Submission
from app.models.course import Course
from app.models.user import User
from app.schemas.assignments import AssignmentCreate, AssignmentResponse, AssignmentUpdate, SubmissionResponse
from app.schemas.base import AppBaseModel

router = APIRouter(tags=["assignments"])


# ── Local request schema ──────────────────────────────────────────────────────

class SubmitRequest(AppBaseModel):
    """Submission payload – provide body (text entry) or file_url (S3 URL), or both."""

    body: str | None = None
    file_url: str | None = Field(None, max_length=2048)

    @model_validator(mode="after")
    def at_least_one_submission_method(self) -> Self:
        if self.body is None and self.file_url is None:
            raise ValueError("Provide either body (text entry) or file_url (S3 URL).")
        return self


# ── Assignment endpoints ──────────────────────────────────────────────────────

@router.get("/courses/{course_id}/assignments", response_model=list[AssignmentResponse])
async def list_assignments(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Assignment]:
    """List all assignments for a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    result = await db.execute(
        select(Assignment).where(Assignment.course_id == course_id)
    )
    return list(result.scalars().all())


@router.post(
    "/courses/{course_id}/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_assignment(
    course_id: UUID,
    payload: AssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Assignment:
    """Create a new assignment in a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    assignment = Assignment(**payload.model_dump())
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def get_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Assignment:
    """Retrieve a single assignment by ID."""
    result = await db.execute(
        select(Assignment).where(Assignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )
    return assignment


@router.put("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: UUID,
    payload: AssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Assignment:
    """Update mutable fields on an assignment."""
    result = await db.execute(
        select(Assignment).where(Assignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)
    await db.flush()
    await db.refresh(assignment)
    return assignment


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an assignment and all its submissions."""
    result = await db.execute(
        select(Assignment).where(Assignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )
    await db.delete(assignment)


# ── Submission endpoint ───────────────────────────────────────────────────────

@router.post(
    "/assignments/{assignment_id}/submit",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_assignment(
    assignment_id: UUID,
    payload: SubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Submission:
    """
    Submit work for an assignment.

    Accepts a JSON text entry (``body``), an S3 file URL (``file_url``), or both.
    Sets ``submitted_at`` to the current UTC timestamp automatically.
    """
    result = await db.execute(
        select(Assignment).where(Assignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found.",
        )

    submission = Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        submitted_at=datetime.now(tz=timezone.utc),
        body=payload.body,
        file_url=payload.file_url,
    )
    db.add(submission)
    try:
        await db.flush()
        await db.refresh(submission)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Submission conflict.",
        ) from exc
    return submission
