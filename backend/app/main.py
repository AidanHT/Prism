"""Prism Backend – FastAPI entry point.

Run locally with:
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    announcements,
    assignments,
    calendar,
    chatbot,
    courses,
    discussions,
    files,
    forum,
    grades,
    grading,
    modules,
    quizzes,
)

app = FastAPI(
    title="Prism LMS API",
    version="0.1.0",
    description="Backend API for Project Prism – Cloud-Native Intelligent LMS",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS – only allow the local Next.js dev server in development.
# In production this is enforced at API Gateway level.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
API_PREFIX = "/api/v1"

# ── Core CRUD routers ──────────────────────────────────────────────────────
app.include_router(courses.router, prefix=API_PREFIX)
app.include_router(assignments.router, prefix=API_PREFIX)
app.include_router(quizzes.router, prefix=API_PREFIX)
app.include_router(modules.router, prefix=API_PREFIX)
app.include_router(grades.router, prefix=API_PREFIX)
app.include_router(discussions.router, prefix=API_PREFIX)
app.include_router(announcements.router, prefix=API_PREFIX)
app.include_router(files.router, prefix=API_PREFIX)
app.include_router(calendar.router, prefix=API_PREFIX)

# ── AI / async microservice routers (implemented in later phases) ──────────
app.include_router(forum.router, prefix=API_PREFIX)
app.include_router(grading.router, prefix=API_PREFIX)
app.include_router(chatbot.router, prefix=API_PREFIX)


@app.get("/api/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Top-level health check for load balancers and CI smoke tests."""
    return {"status": "ok", "service": "prism-backend"}
