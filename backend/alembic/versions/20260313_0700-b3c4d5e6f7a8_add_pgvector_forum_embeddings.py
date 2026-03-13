"""Add pgvector extension and forum_embeddings table.

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-13 07:00:00.000000+00:00

Rationale: Replace Amazon OpenSearch as the vector store with the pgvector
extension on our existing Aurora PostgreSQL database.  This eliminates the
OpenSearch dependency, reduces operational overhead, and keeps all persistent
state within the single PostgreSQL cluster.

Changes:
    1. Enables the ``vector`` extension (requires pg_vector to be installed
       on the PostgreSQL server — available on Aurora PostgreSQL 15+).
    2. Creates the ``forum_embeddings`` table, which is the pgvector backing
       store for forum thread embeddings produced by Amazon Titan V2 (1536-d).
    3. Creates an IVFFlat approximate-nearest-neighbour index on the
       ``embedding`` column using cosine distance for fast k-NN queries.
    4. Creates a B-tree index on ``course_id`` for efficient per-course
       scoping applied as a WHERE filter before the vector scan.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: str = "a1b2c3d4e5f6"
branch_labels: None = None
depends_on: None = None

_EMBEDDING_DIM: int = 1536


def upgrade() -> None:
    # 1. Enable the pgvector extension (idempotent).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. Create the forum_embeddings table.
    op.create_table(
        "forum_embeddings",
        sa.Column("thread_id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("course_id", sa.String(36), nullable=False),
        sa.Column("cluster_id", sa.String(36), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(_EMBEDDING_DIM), nullable=False),
        sa.Column(
            "is_authoritative",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 3. IVFFlat index for approximate cosine-distance nearest-neighbour search.
    #    lists=100 suits up to ~1 M rows; revisit at scale.
    #    NOTE: IVFFlat requires the table to have data before the index is
    #    built in production (VACUUM ANALYZE first); in dev/CI it is fine on
    #    an empty table.
    op.execute(
        """
        CREATE INDEX ix_forum_embeddings_ivfflat
        ON forum_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )

    # 4. B-tree index for course scoping.
    op.create_index(
        "ix_forum_embeddings_course_id",
        "forum_embeddings",
        ["course_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_forum_embeddings_course_id", table_name="forum_embeddings")
    op.drop_index("ix_forum_embeddings_ivfflat", table_name="forum_embeddings")
    op.drop_table("forum_embeddings")
    # Do NOT drop the vector extension — other tables may rely on it in future.
