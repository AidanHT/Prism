"""Grading microservice router.

Handles assignment submissions, AI grading co-pilot, and grade publishing.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/grading", tags=["grading"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "grading"}
