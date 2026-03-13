"""Message and MessageRecipient ORM models."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as pg_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.user import User


class Message(TimestampMixin, Base):
    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    sender_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    course_id: Mapped[UUID | None] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    sender: Mapped[User] = relationship(
        "User",
        back_populates="sent_messages",
        lazy="selectin",
    )
    course: Mapped[Course | None] = relationship(
        "Course",
        back_populates="messages",
        lazy="selectin",
    )
    recipients: Mapped[list[MessageRecipient]] = relationship(
        "MessageRecipient",
        back_populates="message",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class MessageRecipient(TimestampMixin, Base):
    __tablename__ = "message_recipients"

    id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    message_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
    )
    recipient_id: Mapped[UUID] = mapped_column(
        pg_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    message: Mapped[Message] = relationship(
        "Message",
        back_populates="recipients",
        lazy="selectin",
    )
    recipient: Mapped[User] = relationship(
        "User",
        back_populates="received_messages",
        lazy="selectin",
    )
