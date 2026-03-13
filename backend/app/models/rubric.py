"""Rubric and RubricCriterion ORM models."""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.course import Course


class Rubric(TimestampMixin, Base):
    __tablename__ = "rubrics"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="rubrics",
        lazy="selectin",
    )
    criteria: Mapped[list[RubricCriterion]] = relationship(
        "RubricCriterion",
        back_populates="rubric",
        cascade="all, delete-orphan",
        order_by="RubricCriterion.position",
        lazy="selectin",
    )


class RubricCriterion(TimestampMixin, Base):
    __tablename__ = "rubric_criteria"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    rubric_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("rubrics.id", ondelete="CASCADE"),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    points: Mapped[float] = mapped_column(Float, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Array of rating objects: [{id, description, points}, ...]
    ratings: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    rubric: Mapped[Rubric] = relationship(
        "Rubric",
        back_populates="criteria",
        lazy="selectin",
    )
