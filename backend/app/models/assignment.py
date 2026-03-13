"""Assignment and Submission ORM models."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.grade import Grade
    from app.models.user import User


class Assignment(TimestampMixin, Base):
    __tablename__ = "assignments"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    points_possible: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    lock_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Stores valid SubmissionType values; enforced by Pydantic at the API boundary.
    submission_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), nullable=False, server_default="{}"
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="assignments",
        lazy="selectin",
    )
    submissions: Mapped[list[Submission]] = relationship(
        "Submission",
        back_populates="assignment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    grades: Mapped[list[Grade]] = relationship(
        "Grade",
        foreign_keys="[Grade.assignment_id]",
        back_populates="assignment",
        lazy="selectin",
    )


class Submission(TimestampMixin, Base):
    __tablename__ = "submissions"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    assignment_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    grade: Mapped[float | None] = mapped_column(Float, nullable=True)
    grader_id: Mapped[UUID | None] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    graded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    assignment: Mapped[Assignment] = relationship(
        "Assignment",
        back_populates="submissions",
        lazy="selectin",
    )
    student: Mapped[User] = relationship(
        "User",
        foreign_keys=[student_id],
        back_populates="submissions",
        lazy="selectin",
    )
    grader: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[grader_id],
        back_populates="graded_submissions",
        lazy="selectin",
    )
