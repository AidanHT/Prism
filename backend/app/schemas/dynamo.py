"""Pydantic v2 schemas for DynamoDB documents (forum threads/posts, chat sessions)."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import AppBaseModel


class ChatMessage(AppBaseModel):
    """A single message turn stored inside a ChatSession's history."""

    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)
    timestamp: datetime


class ForumThread(AppBaseModel):
    """DynamoDB document representing a high-level forum thread.

    Stored in the ``prism-forum`` table.
    Partition key: ``id``.
    GSI ``course_id-index`` enables queries by course.
    """

    id: str = Field(..., description="UUID string – DynamoDB partition key")
    course_id: str = Field(..., description="UUID string – GSI partition key")
    title: str = Field(..., min_length=1, max_length=500)
    # Semantic cluster this thread belongs to (populated after a clustering run).
    cluster_id: str | None = None
    # Pointer to the corresponding OpenSearch embedding document.
    vector_embedding_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def from_uuids(
        cls,
        id: UUID,
        course_id: UUID,
        title: str,
        cluster_id: str | None = None,
        vector_embedding_id: str | None = None,
    ) -> "ForumThread":
        return cls(
            id=str(id),
            course_id=str(course_id),
            title=title,
            cluster_id=cluster_id,
            vector_embedding_id=vector_embedding_id,
        )


class ForumPost(AppBaseModel):
    """DynamoDB document representing an individual post within a thread.

    Stored in the ``prism-forum-posts`` table.
    Partition key: ``id``.
    GSI ``thread_id-index`` enables queries by thread.
    """

    id: str = Field(..., description="UUID string – DynamoDB partition key")
    thread_id: str = Field(..., description="UUID string – GSI partition key")
    author_id: str = Field(..., description="UUID string of the posting user")
    content: str = Field(..., min_length=1)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def from_uuids(
        cls,
        id: UUID,
        thread_id: UUID,
        author_id: UUID,
        content: str,
    ) -> "ForumPost":
        return cls(
            id=str(id),
            thread_id=str(thread_id),
            author_id=str(author_id),
            content=content,
        )


class ChatSession(AppBaseModel):
    """DynamoDB document representing an AI-assisted chat session.

    Stored in the ``prism-sessions`` table.
    Partition key: ``session_id``.
    GSI ``user_id-index`` enables queries by user.
    """

    session_id: str = Field(..., description="UUID string – DynamoDB partition key")
    user_id: str = Field(..., description="UUID string – GSI partition key")
    # The LMS page URL the user had open when the session started.
    context_viewport_url: str = Field(..., min_length=1)
    message_history: list[ChatMessage] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @classmethod
    def from_uuids(
        cls,
        session_id: UUID,
        user_id: UUID,
        context_viewport_url: str,
    ) -> "ChatSession":
        return cls(
            session_id=str(session_id),
            user_id=str(user_id),
            context_viewport_url=context_viewport_url,
        )
