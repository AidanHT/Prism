"""Courses microservice router.

Handles course catalogue, enrolment, and syllabus operations.
All persistence is backed by DynamoDB via ``dynamo_manager``.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_user
from app.db.dynamo import dynamo_manager
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
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List all courses the current user is enrolled in or teaches."""
    # Step 1: query enrollments for this user
    enrollments = await dynamo_manager.query_enrollments_by_user(current_user["id"])
    if not enrollments:
        return []

    # Step 2: batch-get the course items by their IDs
    course_ids = [e["course_id"] for e in enrollments]
    unique_ids = list(dict.fromkeys(course_ids))  # deduplicate, preserve order
    keys = [{"id": cid} for cid in unique_ids]
    courses = await dynamo_manager.batch_get("prism-courses", keys)

    # Attach enrollments to each course for response compatibility
    enrollment_by_course: dict[str, list[dict[str, Any]]] = {}
    for e in enrollments:
        enrollment_by_course.setdefault(e["course_id"], []).append(e)

    for course in courses:
        course["enrollments"] = enrollment_by_course.get(course["id"], [])

    return courses


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new course."""
    now = datetime.now(timezone.utc).isoformat()
    course_item: dict[str, Any] = {
        "id": str(uuid4()),
        **{k: str(v) if k.endswith("_id") else v for k, v in payload.model_dump().items()},
        "created_at": now,
        "updated_at": now,
    }
    await dynamo_manager.put_course(course_item)
    return course_item


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Return course details including enrolled users and module syllabus."""
    course = await dynamo_manager.get_course(course_id)
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    # Attach enrollments for roster view
    enrollments = await dynamo_manager.query_enrollments_by_course(course_id)
    course["enrollments"] = enrollments
    return course


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    payload: CourseUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Update mutable fields on a course."""
    existing = await dynamo_manager.get_course(course_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    updates = payload.model_dump(exclude_unset=True)
    # Stringify UUID fields so DynamoDB stores them as S-type
    for key in list(updates):
        if key.endswith("_id") and updates[key] is not None:
            updates[key] = str(updates[key])
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = await dynamo_manager.update_course(course_id, updates)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    return updated


@router.get("/{course_id}/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    course_id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List all enrollments (roster) for a course."""
    course = await dynamo_manager.get_course(course_id)
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    return await dynamo_manager.query_enrollments_by_course(course_id)


@router.post(
    "/{course_id}/enrollments",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_enrollment(
    course_id: str,
    payload: EnrollmentCreate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Enroll a user in a course."""
    course = await dynamo_manager.get_course(course_id)
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found.",
        )
    # Check if user is already enrolled
    existing_enrollments = await dynamo_manager.query_enrollments_by_course(course_id)
    user_id_str = str(payload.user_id)
    for e in existing_enrollments:
        if e.get("user_id") == user_id_str:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already enrolled in this course.",
            )
    now = datetime.now(timezone.utc).isoformat()
    enrollment_item: dict[str, Any] = {
        "id": str(uuid4()),
        "user_id": user_id_str,
        "course_id": str(payload.course_id),
        "role": payload.role.value if hasattr(payload.role, "value") else str(payload.role),
        "enrolled_at": now,
        "created_at": now,
        "updated_at": now,
    }
    await dynamo_manager.put_enrollment(enrollment_item)
    return enrollment_item


@router.put(
    "/{course_id}/enrollments/{enrollment_id}",
    response_model=EnrollmentResponse,
)
async def update_enrollment(
    course_id: str,
    enrollment_id: str,
    payload: EnrollmentUpdate,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Update a user's enrollment role."""
    existing = await dynamo_manager.get_enrollment(enrollment_id)
    if existing is None or existing.get("course_id") != course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found.",
        )
    updates = payload.model_dump(exclude_unset=True)
    # Convert enum values to strings for DynamoDB
    for key in list(updates):
        val = updates[key]
        if hasattr(val, "value"):
            updates[key] = val.value
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = await dynamo_manager.update_enrollment(enrollment_id, updates)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found.",
        )
    return updated
