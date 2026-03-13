"""ForumEmbedding ORM model – pgvector storage for forum thread embeddings.

Each row represents a DynamoDB forum thread whose title+content has been
embedded with Amazon Titan Embeddings V2 (1536 dimensions).  The table
serves as the primary vector store for:

- Semantic k-NN search (``/forum/search``, ``/forum/ask`` RAG pipeline).
- Authoritative knowledge-base lookup (``/forum/ta-check``,
  ``/forum/add-to-brain``).

The ``thread_id`` is the DynamoDB partition key (UUID string) rather than
a FK to any PostgreSQL table, keeping the two stores decoupled.
"""
from __future__ import annotations

from sqlalchemy import Boolean, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from pgvector.sqlalchemy import Vector

_EMBEDDING_DIM: int = 1536


class ForumEmbedding(TimestampMixin, Base):
    """One row per forum thread, holding its Titan V2 embedding vector."""

    __tablename__ = "forum_embeddings"

    # DynamoDB thread UUID (partition key) – treated as an opaque string.
    thread_id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # DynamoDB course UUID – used for per-course scoping in search queries.
    course_id: Mapped[str] = mapped_column(String(36), nullable=False)

    # Semantic cluster the thread belongs to (inherits from top-scoring hit).
    cluster_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Denormalised text kept for RAG context assembly without a DynamoDB round-trip.
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # 1536-dimensional Titan Embeddings V2 vector (cosine-normalised).
    embedding: Mapped[list[float]] = mapped_column(Vector(_EMBEDDING_DIM), nullable=False)

    # True when a professor/TA has explicitly added this to the knowledge base.
    is_authoritative: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    __table_args__ = (
        # IVFFlat index for approximate cosine-distance search.
        # lists=100 is a reasonable default for up to ~1 M rows; tune at scale.
        Index(
            "ix_forum_embeddings_ivfflat",
            "embedding",
            postgresql_using="ivfflat",
            postgresql_with={"lists": 100},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        # B-tree index to speed up the WHERE course_id = … filter.
        Index("ix_forum_embeddings_course_id", "course_id"),
    )
