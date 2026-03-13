"""Discussion and DiscussionReply ORM models."""
from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Discussion(TimestampMixin, Base):
    __tablename__ = "discussions"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    course_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    is_locked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    course: Mapped[Course] = relationship(
        "Course",
        back_populates="discussions",
        lazy="selectin",
    )
    author: Mapped[User] = relationship(
        "User",
        back_populates="discussions",
        lazy="selectin",
    )
    replies: Mapped[list[DiscussionReply]] = relationship(
        "DiscussionReply",
        back_populates="discussion",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class DiscussionReply(TimestampMixin, Base):
    __tablename__ = "discussion_replies"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    discussion_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("discussions.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    parent_reply_id: Mapped[UUID | None] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("discussion_replies.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    discussion: Mapped[Discussion] = relationship(
        "Discussion",
        back_populates="replies",
        lazy="selectin",
    )
    author: Mapped[User] = relationship(
        "User",
        back_populates="discussion_replies",
        lazy="selectin",
    )
    # Self-referential: many-to-one (child → parent)
    parent_reply: Mapped[DiscussionReply | None] = relationship(
        "DiscussionReply",
        foreign_keys="[DiscussionReply.parent_reply_id]",
        remote_side="DiscussionReply.id",
        back_populates="child_replies",
        lazy="selectin",
    )
    # Self-referential: one-to-many (parent → children)
    child_replies: Mapped[list[DiscussionReply]] = relationship(
        "DiscussionReply",
        foreign_keys="[DiscussionReply.parent_reply_id]",
        back_populates="parent_reply",
        lazy="selectin",
    )
