"""Quiz, QuizQuestion, and QuizAttempt ORM models."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.enums import QuestionType

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.grade import Grade
    from app.models.user import User


class Quiz(TimestampMixin, Base):
    __tablename__ = "quizzes"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attempt_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    points_possible: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    available_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    available_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="quizzes",
        lazy="selectin",
    )
    questions: Mapped[list[QuizQuestion]] = relationship(
        "QuizQuestion",
        back_populates="quiz",
        cascade="all, delete-orphan",
        order_by="QuizQuestion.position",
        lazy="selectin",
    )
    attempts: Mapped[list[QuizAttempt]] = relationship(
        "QuizAttempt",
        back_populates="quiz",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    grades: Mapped[list[Grade]] = relationship(
        "Grade",
        foreign_keys="[Grade.quiz_id]",
        back_populates="quiz",
        lazy="selectin",
    )


class QuizQuestion(TimestampMixin, Base):
    __tablename__ = "quiz_questions"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    quiz_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_type: Mapped[QuestionType] = mapped_column(
        SAEnum(QuestionType, name="questiontype"), nullable=False
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # For MC/matching: list of option objects; null for short_answer/essay.
    options: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ──────────────────────────────────────────────────────────
    quiz: Mapped[Quiz] = relationship(
        "Quiz",
        back_populates="questions",
        lazy="selectin",
    )


class QuizAttempt(TimestampMixin, Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    quiz_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
    )
    student_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Maps question_id -> student answer value.
    answers: Mapped[dict[str, object]] = mapped_column(
        JSONB, nullable=False, server_default="{}"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    quiz: Mapped[Quiz] = relationship(
        "Quiz",
        back_populates="attempts",
        lazy="selectin",
    )
    student: Mapped[User] = relationship(
        "User",
        back_populates="quiz_attempts",
        lazy="selectin",
    )
