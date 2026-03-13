"""Course, Enrollment, Module, and ModuleItem ORM models."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import EnrollmentRole, ModuleItemType

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.calendar import CalendarEvent
    from app.models.content import Announcement, CourseFile, Page
    from app.models.discussion import Discussion
    from app.models.grade import Grade
    from app.models.message import Message
    from app.models.quiz import Quiz
    from app.models.rubric import Rubric
    from app.models.user import User


class Course(TimestampMixin, Base):
    __tablename__ = "courses"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    term: Mapped[str | None] = mapped_column(String(50), nullable=True)
    instructor_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    grading_scheme: Mapped[dict[str, object] | None] = mapped_column(
        JSONB, nullable=True
    )
    late_policy: Mapped[dict[str, object] | None] = mapped_column(
        JSONB, nullable=True
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    instructor: Mapped[User] = relationship(
        "User",
        back_populates="courses_taught",
        lazy="selectin",
    )
    enrollments: Mapped[list[Enrollment]] = relationship(
        "Enrollment",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    modules: Mapped[list[Module]] = relationship(
        "Module",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="Module.position",
        lazy="selectin",
    )
    assignments: Mapped[list[Assignment]] = relationship(
        "Assignment",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    quizzes: Mapped[list[Quiz]] = relationship(
        "Quiz",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    discussions: Mapped[list[Discussion]] = relationship(
        "Discussion",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    announcements: Mapped[list[Announcement]] = relationship(
        "Announcement",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    pages: Mapped[list[Page]] = relationship(
        "Page",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    files: Mapped[list[CourseFile]] = relationship(
        "CourseFile",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    rubrics: Mapped[list[Rubric]] = relationship(
        "Rubric",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    calendar_events: Mapped[list[CalendarEvent]] = relationship(
        "CalendarEvent",
        back_populates="course",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    messages: Mapped[list[Message]] = relationship(
        "Message",
        back_populates="course",
        lazy="selectin",
    )


class Enrollment(TimestampMixin, Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),
    )

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[EnrollmentRole] = mapped_column(
        SAEnum(EnrollmentRole, name="enrollmentrole"), nullable=False
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    user: Mapped[User] = relationship(
        "User",
        back_populates="enrollments",
        lazy="selectin",
    )
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="enrollments",
        lazy="selectin",
    )
    grades: Mapped[list[Grade]] = relationship(
        "Grade",
        back_populates="enrollment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Module(TimestampMixin, Base):
    __tablename__ = "modules"

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
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="modules",
        lazy="selectin",
    )
    items: Mapped[list[ModuleItem]] = relationship(
        "ModuleItem",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="ModuleItem.position",
        lazy="selectin",
    )


class ModuleItem(TimestampMixin, Base):
    __tablename__ = "module_items"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    module_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_type: Mapped[ModuleItemType] = mapped_column(
        SAEnum(ModuleItemType, name="moduleitemtype"), nullable=False
    )
    # Logical reference to the actual content row (Assignment, Quiz, Page, etc.)
    item_id: Mapped[UUID] = mapped_column(pg_UUID(as_uuid=True), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    module: Mapped[Module] = relationship(
        "Module",
        back_populates="items",
        lazy="selectin",
    )
