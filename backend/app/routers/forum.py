"""Forum microservice router.

Handles forum threads, posts, and AI-powered auto-suggestions.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "forum"}
