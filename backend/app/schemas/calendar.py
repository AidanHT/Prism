"""Pydantic v2 schemas for CalendarEvent."""
from __future__ import annotations

from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import ConfigDict, Field, model_validator

from app.models.enums import EventType
from app.schemas.base import AppBaseModel


class CalendarEventBase(AppBaseModel):
    course_id: UUID | None = None
    user_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    event_type: EventType
    start_date: datetime
    end_date: datetime


class CalendarEventCreate(CalendarEventBase):
    @model_validator(mode="after")
    def end_after_start(self) -> Self:
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class CalendarEventUpdate(AppBaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    event_type: EventType | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class CalendarEventResponse(CalendarEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
