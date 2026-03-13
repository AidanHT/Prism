"""Courses microservice router.

Handles course catalogue, enrolment, and syllabus operations.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "courses"}
