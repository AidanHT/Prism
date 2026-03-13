"""Announcement, Page, and CourseFile ORM models."""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Announcement(TimestampMixin, Base):
    __tablename__ = "announcements"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="announcements",
        lazy="selectin",
    )
    author: Mapped[User] = relationship(
        "User",
        back_populates="announcements",
        lazy="selectin",
    )


class Page(TimestampMixin, Base):
    __tablename__ = "pages"
    __table_args__ = (
        UniqueConstraint("course_id", "slug", name="uq_page_course_slug"),
    )

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="pages",
        lazy="selectin",
    )
    author: Mapped[User] = relationship(
        "User",
        back_populates="pages",
        lazy="selectin",
    )


class CourseFile(TimestampMixin, Base):
    __tablename__ = "course_files"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    folder_path: Mapped[str] = mapped_column(String(1024), nullable=False, default="/")
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        name="uploaded_by",
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="files",
        lazy="selectin",
    )
    uploader: Mapped[User] = relationship(
        "User",
        foreign_keys=[uploaded_by_id],
        back_populates="uploaded_files",
        lazy="selectin",
    )
