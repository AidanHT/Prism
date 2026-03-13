"""Courses microservice router.

Handles course catalogue, enrolment, and syllabus operations.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db
from app.models.course import Course, Enrollment
from app.models.user import User
from app.schemas.courses import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentResponse,
    EnrollmentUpdate,
)

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("", response_model=list[CourseResponse])
async def list_enrolled_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Course]:
    """List all courses the current user is enrolled in or teaches."""
    result = await db.execute(
        select(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .where(Enrollment.user_id == current_user.id)
        .options(selectinload(Course.enrollments))
    )
    return list(result.scalars().unique().all())


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Course:
    """Create a new course."""
    course = Course(**payload.model_dump())
    db.add(course)
    try:
        await db.flush()
        await db.refresh(course)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A course with that code already exists in this term.",
        ) from exc
    return course


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Course:
    """Return course details including enrolled users and module syllabus."""
    result = await db.execute(
        select(Course)
        .where(Course.id == course_id)
        .options(
            selectinload(Course.enrollments),
            selectinload(Course.modules),
        )
    )
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    return course


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: UUID,
    payload: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Course:
    """Update mutable fields on a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    try:
        await db.flush()
        await db.refresh(course)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflict updating course – check code uniqueness.",
        ) from exc
    return course


@router.get("/{course_id}/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Enrollment]:
    """List all enrollments (roster) for a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    result = await db.execute(
        select(Enrollment).where(Enrollment.course_id == course_id)
    )
    return list(result.scalars().all())


@router.post(
    "/{course_id}/enrollments",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_enrollment(
    course_id: UUID,
    payload: EnrollmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Enrollment:
    """Enroll a user in a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    enrollment = Enrollment(**payload.model_dump())
    db.add(enrollment)
    try:
        await db.flush()
        await db.refresh(enrollment)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already enrolled in this course.",
        ) from exc
    return enrollment


@router.put(
    "/{course_id}/enrollments/{enrollment_id}",
    response_model=EnrollmentResponse,
)
async def update_enrollment(
    course_id: UUID,
    enrollment_id: UUID,
    payload: EnrollmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Enrollment:
    """Update a user's enrollment role."""
    result = await db.execute(
        select(Enrollment).where(
            Enrollment.id == enrollment_id,
            Enrollment.course_id == course_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found.",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(enrollment, field, value)
    await db.flush()
    await db.refresh(enrollment)
    return enrollment
