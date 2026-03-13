"""Announcements microservice router.

Handles course announcements and triggers event-driven fan-out side effects.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "announcements"}
