"""Grade ORM model."""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.course import Enrollment
    from app.models.quiz import Quiz
    from app.models.user import User


class Grade(TimestampMixin, Base):
    __tablename__ = "grades"
    __table_args__ = (
        # Exactly one of assignment_id or quiz_id must be non-null.
        CheckConstraint(
            "num_nonnulls(assignment_id, quiz_id) = 1",
            name="ck_grade_one_gradeable",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    enrollment_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
    )
    assignment_id: Mapped[UUID | None] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        nullable=True,
    )
    quiz_id: Mapped[UUID | None] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=True,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    grader_id: Mapped[UUID | None] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    enrollment: Mapped[Enrollment] = relationship(
        "Enrollment",
        back_populates="grades",
        lazy="selectin",
    )
    assignment: Mapped[Assignment | None] = relationship(
        "Assignment",
        foreign_keys=[assignment_id],
        back_populates="grades",
        lazy="selectin",
    )
    quiz: Mapped[Quiz | None] = relationship(
        "Quiz",
        foreign_keys=[quiz_id],
        back_populates="grades",
        lazy="selectin",
    )
    grader: Mapped[User | None] = relationship(
        "User",
        foreign_keys=[grader_id],
        back_populates="graded_grades",
        lazy="selectin",
    )
