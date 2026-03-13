"""Announcements microservice router.

Handles course announcements.  Publishing an announcement can be extended to
trigger an EventBridge fan-out for email/push notifications when moving off
the MVP (replace the placeholder comment in ``create_announcement``).
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.models.content import Announcement
from app.models.course import Course
from app.models.user import User
from app.schemas.content import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate

router = APIRouter(tags=["announcements"])


@router.get(
    "/courses/{course_id}/announcements",
    response_model=list[AnnouncementResponse],
)
async def list_announcements(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Announcement]:
    """List all announcements for a course, newest first."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    result = await db.execute(
        select(Announcement)
        .where(Announcement.course_id == course_id)
        .order_by(Announcement.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/courses/{course_id}/announcements",
    response_model=AnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_announcement(
    course_id: UUID,
    payload: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Announcement:
    """
    Create a new course announcement.

    When ``is_published`` is ``True``, this is where an EventBridge
    ``announcement.published`` event would be emitted to fan-out
    email/push notifications in the production architecture.
    """
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    announcement = Announcement(**payload.model_dump())
    db.add(announcement)
    await db.flush()
    await db.refresh(announcement)
    # TODO(eventbridge): if announcement.is_published: emit "announcement.published" event
    return announcement


@router.get("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def get_announcement(
    announcement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Announcement:
    """Retrieve a single announcement by ID."""
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")
    return announcement


@router.put("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: UUID,
    payload: AnnouncementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Announcement:
    """Update an announcement's content or publish state."""
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(announcement, field, value)
    await db.flush()
    await db.refresh(announcement)
    return announcement


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    announcement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete an announcement."""
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    announcement = result.scalar_one_or_none()
    if announcement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")
    await db.delete(announcement)
