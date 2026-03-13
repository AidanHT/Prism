"""Calendar microservice router.

Returns CalendarEvents within a date range for all courses the user is
enrolled in, plus the user's personal events.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.models.calendar import CalendarEvent
from app.models.course import Enrollment
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventUpdate,
)

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarEventResponse])
async def get_calendar(
    start_date: datetime = Query(..., description="Inclusive start of the date range (ISO 8601)."),
    end_date: datetime = Query(..., description="Inclusive end of the date range (ISO 8601)."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CalendarEvent]:
    """
    Return all calendar events visible to the current user within a date range.

    Includes:
    - Events for every course the user is enrolled in.
    - Personal events owned by the user (``user_id`` matches).

    Events are ordered by ``start_date`` ascending.
    """
    if end_date <= start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be after start_date.",
        )

    # Collect all course IDs the user is enrolled in (single query).
    enr_result = await db.execute(
        select(Enrollment.course_id).where(Enrollment.user_id == current_user.id)
    )
    course_ids = list(enr_result.scalars().all())

    result = await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.start_date >= start_date,
            CalendarEvent.start_date <= end_date,
            or_(
                CalendarEvent.course_id.in_(course_ids),
                CalendarEvent.user_id == current_user.id,
            ),
        )
        .order_by(CalendarEvent.start_date.asc())
    )
    return list(result.scalars().all())


@router.post("", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarEvent:
    """Create a calendar event (course-level or personal)."""
    event = CalendarEvent(**payload.model_dump())
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


@router.put("/{event_id}", response_model=CalendarEventResponse)
async def update_calendar_event(
    event_id: UUID,
    payload: CalendarEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarEvent:
    """Update a calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    await db.flush()
    await db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a calendar event."""
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    await db.delete(event)
