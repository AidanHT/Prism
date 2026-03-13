"""Grades microservice router.

Provides:
- Student grade view for a single course enrolment.
- Professor gradebook view (all students × all grades) – fetched with
  batched SELECT IN queries to avoid any N+1 problem.
- Generic grade create / update endpoints.
- CSV export of the gradebook (streaming response).
"""
from __future__ import annotations

import csv
import io
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db
from app.models.assignment import Assignment
from app.models.course import Course, Enrollment
from app.models.grade import Grade
from app.models.user import User
from app.schemas.base import AppBaseModel
from app.schemas.grades import GradeCreate, GradeResponse, GradeUpdate, GradeWithAnomalyResponse

router = APIRouter(tags=["grades"])


# ── Local response schemas for the gradebook ─────────────────────────────────

class GradebookGradeEntry(AppBaseModel):
    grade_id: UUID
    assignment_id: UUID | None
    quiz_id: UUID | None
    score: float
    max_score: float


class GradebookStudentRow(AppBaseModel):
    student_id: UUID
    student_name: str
    student_email: str
    enrollment_id: UUID
    grades: list[GradebookGradeEntry]


class GradebookAssignment(AppBaseModel):
    id: UUID
    title: str
    points_possible: float


class GradebookResponse(AppBaseModel):
    course_id: UUID
    assignments: list[GradebookAssignment]
    students: list[GradebookStudentRow]


# ── Student grade view ────────────────────────────────────────────────────────

@router.get("/courses/{course_id}/grades", response_model=list[GradeResponse])
async def get_my_grades(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Grade]:
    """
    Return the current user's grades for a specific course.

    Looks up the user's enrolment in the course, then returns all grade rows
    associated with that enrolment.
    """
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    enr_result = await db.execute(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.user_id == current_user.id,
        )
    )
    enrollment = enr_result.scalar_one_or_none()
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this course.",
        )

    result = await db.execute(
        select(Grade).where(Grade.enrollment_id == enrollment.id)
    )
    return list(result.scalars().all())


# ── Professor gradebook view ──────────────────────────────────────────────────

@router.get("/courses/{course_id}/gradebook", response_model=GradebookResponse)
async def get_gradebook(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GradebookResponse:
    """
    Spreadsheet-style gradebook for professors.

    Issues exactly four batched queries – no N+1 regardless of roster size:
      1. SELECT enrollments WHERE course_id = ?
      2. SELECT IN users  (selectinload)
      3. SELECT IN grades (selectinload)
      4. SELECT assignments WHERE course_id = ?
    """
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    # Batch-load enrollments with nested users and grades.
    enr_result = await db.execute(
        select(Enrollment)
        .where(Enrollment.course_id == course_id)
        .options(
            selectinload(Enrollment.user),
            selectinload(Enrollment.grades),
        )
    )
    enrollments = enr_result.scalars().all()

    # Batch-load all assignments for the course.
    asgn_result = await db.execute(
        select(Assignment).where(Assignment.course_id == course_id)
    )
    assignments = asgn_result.scalars().all()

    student_rows = [
        GradebookStudentRow(
            student_id=enr.user_id,
            student_name=enr.user.name,
            student_email=enr.user.email,
            enrollment_id=enr.id,
            grades=[
                GradebookGradeEntry(
                    grade_id=g.id,
                    assignment_id=g.assignment_id,
                    quiz_id=g.quiz_id,
                    score=g.score,
                    max_score=g.max_score,
                )
                for g in enr.grades
            ],
        )
        for enr in enrollments
    ]

    assignment_entries = [
        GradebookAssignment(
            id=a.id,
            title=a.title,
            points_possible=a.points_possible,
        )
        for a in assignments
    ]

    return GradebookResponse(
        course_id=course_id,
        assignments=assignment_entries,
        students=student_rows,
    )


# ── Gradebook CSV export ──────────────────────────────────────────────────────


@router.get(
    "/courses/{course_id}/gradebook/export",
    summary="Export gradebook as CSV",
)
async def export_gradebook_csv(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    Stream a CSV file with one row per student and one column per assignment.

    Columns: Student Name, Email, <assignment titles…>, Total Earned,
    Total Possible, Percentage.
    """
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    enr_result = await db.execute(
        select(Enrollment)
        .where(Enrollment.course_id == course_id)
        .options(selectinload(Enrollment.user), selectinload(Enrollment.grades))
    )
    enrollments = enr_result.scalars().all()

    asgn_result = await db.execute(
        select(Assignment).where(Assignment.course_id == course_id)
    )
    assignments = asgn_result.scalars().all()

    # Build CSV in memory
    buf = io.StringIO()
    writer = csv.writer(buf)

    header = (
        ["Student Name", "Email"]
        + [a.title for a in assignments]
        + ["Total Earned", "Total Possible", "Percentage"]
    )
    writer.writerow(header)

    for enr in sorted(enrollments, key=lambda e: e.user.name):
        grade_map = {g.assignment_id: g for g in enr.grades if g.assignment_id}
        row_scores: list[str] = []
        total_earned = 0.0
        total_possible = 0.0
        for a in assignments:
            grade = grade_map.get(a.id)
            if grade:
                row_scores.append(f"{grade.score}/{grade.max_score}")
                total_earned += grade.score
                total_possible += grade.max_score
            else:
                row_scores.append("")

        pct = round((total_earned / total_possible * 100), 1) if total_possible > 0 else 0
        writer.writerow(
            [enr.user.name, enr.user.email]
            + row_scores
            + [total_earned, total_possible, f"{pct}%"]
        )

    csv_bytes = buf.getvalue().encode("utf-8")

    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="gradebook_{course_id}.csv"',
            "Content-Length": str(len(csv_bytes)),
        },
    )


# ── Grade CRUD ────────────────────────────────────────────────────────────────

@router.post("/grades", response_model=GradeResponse, status_code=status.HTTP_201_CREATED)
async def create_grade(
    payload: GradeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Grade:
    """Create a grade record for an assignment or quiz attempt."""
    grade = Grade(**payload.model_dump())
    db.add(grade)
    try:
        await db.flush()
        await db.refresh(grade)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A grade for this enrolment / gradeable already exists.",
        ) from exc
    return grade


# Threshold (in percentage points, 0–1 scale) beyond which a grade is flagged.
_ANOMALY_THRESHOLD = 0.15


@router.put("/grades/{grade_id}", response_model=GradeWithAnomalyResponse)
async def update_grade(
    grade_id: UUID,
    payload: GradeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GradeWithAnomalyResponse:
    """Update an existing grade and return an anomaly flag when the score
    deviates more than 15 percentage points from the class average or the
    AI-suggested score.
    """
    result = await db.execute(select(Grade).where(Grade.id == grade_id))
    grade = result.scalar_one_or_none()
    if grade is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found.")

    # Persist the new field values (exclude our synthetic ai_suggested_score).
    for field, value in payload.model_dump(exclude_unset=True, exclude={"ai_suggested_score"}).items():
        setattr(grade, field, value)
    await db.flush()
    await db.refresh(grade)

    # ── Anomaly detection ─────────────────────────────────────────────────────
    anomaly_flag = False
    new_score = grade.score
    max_score = grade.max_score

    if grade.assignment_id is not None and max_score > 0:
        new_pct = new_score / max_score

        # Class average (as a percentage) across all *other* graded submissions
        # for the same assignment so we don't skew the baseline with this grade.
        avg_result = await db.execute(
            select(func.avg(Grade.score / Grade.max_score)).where(
                Grade.assignment_id == grade.assignment_id,
                Grade.id != grade_id,
                Grade.max_score > 0,
            )
        )
        class_avg_pct: float | None = avg_result.scalar_one_or_none()

        if class_avg_pct is not None and abs(new_pct - class_avg_pct) > _ANOMALY_THRESHOLD:
            anomaly_flag = True

        # Also compare against the AI-suggested score when the frontend provides it.
        if not anomaly_flag and payload.ai_suggested_score is not None:
            ai_pct = payload.ai_suggested_score / max_score
            if abs(new_pct - ai_pct) > _ANOMALY_THRESHOLD:
                anomaly_flag = True

    return GradeWithAnomalyResponse(
        **GradeResponse.model_validate(grade).model_dump(),
        anomaly_flag=anomaly_flag,
    )
