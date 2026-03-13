"""User ORM model."""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Enum as SAEnum, String, Text
from sqlalchemy.dialects.postgresql import UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.assignment import Submission
    from app.models.calendar import CalendarEvent
    from app.models.content import Announcement, CourseFile, Page
    from app.models.course import Course, Enrollment
    from app.models.discussion import Discussion, DiscussionReply
    from app.models.grade import Grade
    from app.models.message import Message, MessageRecipient
    from app.models.notification import Notification
    from app.models.quiz import QuizAttempt


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole"), nullable=False
    )
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default="UTC"
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Relationships ──────────────────────────────────────────────────────────
    courses_taught: Mapped[list[Course]] = relationship(
        "Course",
        back_populates="instructor",
        lazy="selectin",
    )
    enrollments: Mapped[list[Enrollment]] = relationship(
        "Enrollment",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    submissions: Mapped[list[Submission]] = relationship(
        "Submission",
        foreign_keys="[Submission.student_id]",
        back_populates="student",
        lazy="selectin",
    )
    graded_submissions: Mapped[list[Submission]] = relationship(
        "Submission",
        foreign_keys="[Submission.grader_id]",
        back_populates="grader",
        lazy="selectin",
    )
    quiz_attempts: Mapped[list[QuizAttempt]] = relationship(
        "QuizAttempt",
        back_populates="student",
        lazy="selectin",
    )
    discussions: Mapped[list[Discussion]] = relationship(
        "Discussion",
        back_populates="author",
        lazy="selectin",
    )
    discussion_replies: Mapped[list[DiscussionReply]] = relationship(
        "DiscussionReply",
        back_populates="author",
        lazy="selectin",
    )
    announcements: Mapped[list[Announcement]] = relationship(
        "Announcement",
        back_populates="author",
        lazy="selectin",
    )
    pages: Mapped[list[Page]] = relationship(
        "Page",
        back_populates="author",
        lazy="selectin",
    )
    uploaded_files: Mapped[list[CourseFile]] = relationship(
        "CourseFile",
        back_populates="uploader",
        lazy="selectin",
    )
    graded_grades: Mapped[list[Grade]] = relationship(
        "Grade",
        foreign_keys="[Grade.grader_id]",
        back_populates="grader",
        lazy="selectin",
    )
    calendar_events: Mapped[list[CalendarEvent]] = relationship(
        "CalendarEvent",
        back_populates="user",
        lazy="selectin",
    )
    sent_messages: Mapped[list[Message]] = relationship(
        "Message",
        back_populates="sender",
        lazy="selectin",
    )
    received_messages: Mapped[list[MessageRecipient]] = relationship(
        "MessageRecipient",
        back_populates="recipient",
        lazy="selectin",
    )
    notifications: Mapped[list[Notification]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
