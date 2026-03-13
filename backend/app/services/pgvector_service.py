"""pgvector service – vector embeddings and cosine-distance semantic search.

Replaces the former OpenSearch service.  Amazon Titan Embeddings V2 (via
Bedrock) still produces the 1536-dimensional vectors; they are now persisted
in the ``forum_embeddings`` table (PostgreSQL + pgvector) rather than an
OpenSearch index.

All Bedrock I/O is offloaded to the default thread-pool executor so it does
not stall the FastAPI event loop.  SQLAlchemy async sessions are passed in
explicitly so callers can manage transaction boundaries.
"""
from __future__ import annotations

import asyncio
import json
from functools import partial
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forum_embedding import ForumEmbedding
from app.services.bedrock import get_bedrock_client

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EMBEDDING_MODEL_ID: str = "amazon.titan-embed-text-v2:0"
_EMBEDDING_DIM: int = 1536


# ---------------------------------------------------------------------------
# Embeddings pipeline (unchanged from opensearch_service)
# ---------------------------------------------------------------------------


def _embed_text_sync(text: str) -> list[float]:
    """Call Amazon Titan Embeddings V2 synchronously via the shared Bedrock client.

    Uses the raw ``invoke_model`` Boto3 method (not the Converse API wrapper)
    because Titan uses its own JSON request/response envelope.
    """
    client = get_bedrock_client()
    body = json.dumps(
        {
            "inputText": text,
            "dimensions": _EMBEDDING_DIM,
            "normalize": True,
        }
    )
    response = client.invoke_model(
        modelId=_EMBEDDING_MODEL_ID,
        body=body,
        contentType="application/json",
        accept="application/json",
    )
    result: dict[str, Any] = json.loads(response["body"].read())
    return result["embedding"]  # type: ignore[return-value]


async def embed_text(text: str) -> list[float]:
    """Async wrapper: generate a 1536-dimensional Titan embedding for *text*."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, partial(_embed_text_sync, text))


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------


async def upsert_forum_thread(
    session: AsyncSession,
    *,
    thread_id: str,
    course_id: str,
    cluster_id: str | None,
    title: str,
    content: str,
) -> str:
    """Embed *title + content* and upsert a row into ``forum_embeddings``.

    Uses ``thread_id`` as the primary key so repeated calls are idempotent
    (re-embedding on content edits simply overwrites the previous row).

    Returns:
        *thread_id* (echoed back for API compatibility with the previous
        OpenSearch service which returned the document ``_id``).
    """
    combined_text = f"{title}\n\n{content}"
    vector = await embed_text(combined_text)

    row = await session.get(ForumEmbedding, thread_id)
    if row is None:
        row = ForumEmbedding(
            thread_id=thread_id,
            course_id=course_id,
            cluster_id=cluster_id,
            title=title,
            content=content,
            embedding=vector,
            is_authoritative=False,
        )
        session.add(row)
    else:
        row.course_id = course_id
        row.cluster_id = cluster_id
        row.title = title
        row.content = content
        row.embedding = vector  # type: ignore[assignment]

    await session.commit()
    return thread_id


async def upsert_authoritative_document(
    session: AsyncSession,
    *,
    thread_id: str,
    course_id: str,
    cluster_id: str | None,
    title: str,
    content: str,
) -> str:
    """Embed *title + content* and mark the row as authoritative.

    Professors and TAs call this via ``/forum/add-to-brain``.  Marks the row
    with ``is_authoritative = True`` so it is exclusively targeted by the TA
    tone-checker search.  Idempotent — repeated calls overwrite the previous
    version.

    Returns:
        *thread_id* (echoed back for API response).
    """
    combined_text = f"{title}\n\n{content}"
    vector = await embed_text(combined_text)

    row = await session.get(ForumEmbedding, thread_id)
    if row is None:
        row = ForumEmbedding(
            thread_id=thread_id,
            course_id=course_id,
            cluster_id=cluster_id,
            title=title,
            content=content,
            embedding=vector,
            is_authoritative=True,
        )
        session.add(row)
    else:
        row.course_id = course_id
        row.cluster_id = cluster_id
        row.title = title
        row.content = content
        row.embedding = vector  # type: ignore[assignment]
        row.is_authoritative = True

    await session.commit()
    return thread_id


# ---------------------------------------------------------------------------
# Semantic search helpers
# ---------------------------------------------------------------------------


def _cosine_similarity(cosine_distance: float) -> float:
    """Convert pgvector ``<=>`` cosine distance to a [−1, 1] similarity score.

    pgvector ``<=>`` returns ``1 − cosine_similarity`` for L2-normalised
    vectors, so the inverse is ``similarity = 1 − distance``.  Titan V2
    returns normalised vectors when ``normalize: True`` is set, so this
    mapping is exact.
    """
    return 1.0 - float(cosine_distance)


async def search_similar_threads(
    session: AsyncSession,
    question: str,
    *,
    k: int = 5,
    course_id: str | None = None,
) -> list[dict[str, Any]]:
    """Cosine-distance k-NN search: find forum threads similar to *question*.

    Embeds *question* with Titan and issues a SQLAlchemy query that orders
    rows by cosine distance (``<=>`` operator) from pgvector.  When
    *course_id* is supplied, a ``WHERE course_id = …`` filter is applied
    before the vector scan so results are scoped to the course.

    Args:
        session: Active async SQLAlchemy session.
        question: The student's natural-language question.
        k: Number of nearest-neighbour results to return (1–20).
        course_id: Optional course UUID to scope results.

    Returns:
        A list of dicts, each containing ``thread_id``, ``course_id``,
        ``cluster_id``, ``title``, ``content``, and ``_score``
        (cosine similarity in [−1, 1], higher is more similar).
    """
    query_vector = await embed_text(question)

    stmt = select(
        ForumEmbedding.thread_id,
        ForumEmbedding.course_id,
        ForumEmbedding.cluster_id,
        ForumEmbedding.title,
        ForumEmbedding.content,
        ForumEmbedding.embedding.cosine_distance(query_vector).label("distance"),  # type: ignore[attr-defined]
    ).order_by(
        ForumEmbedding.embedding.cosine_distance(query_vector)  # type: ignore[attr-defined]
    ).limit(k)

    if course_id is not None:
        stmt = stmt.where(ForumEmbedding.course_id == course_id)

    result = await session.execute(stmt)
    rows = result.all()

    return [
        {
            "thread_id": row.thread_id,
            "course_id": row.course_id,
            "cluster_id": row.cluster_id,
            "title": row.title,
            "content": row.content,
            "_score": _cosine_similarity(row.distance),
        }
        for row in rows
    ]


async def search_authoritative_threads(
    session: AsyncSession,
    question: str,
    *,
    k: int = 5,
    course_id: str | None = None,
) -> list[dict[str, Any]]:
    """Cosine-distance search restricted to professor/TA-approved documents.

    Identical to :func:`search_similar_threads` but adds an
    ``is_authoritative = true`` WHERE clause so only knowledge-base entries
    created via the *Add to Brain* workflow are returned.
    """
    query_vector = await embed_text(question)

    stmt = select(
        ForumEmbedding.thread_id,
        ForumEmbedding.course_id,
        ForumEmbedding.cluster_id,
        ForumEmbedding.title,
        ForumEmbedding.content,
        ForumEmbedding.embedding.cosine_distance(query_vector).label("distance"),  # type: ignore[attr-defined]
    ).where(
        ForumEmbedding.is_authoritative.is_(True)
    ).order_by(
        ForumEmbedding.embedding.cosine_distance(query_vector)  # type: ignore[attr-defined]
    ).limit(k)

    if course_id is not None:
        stmt = stmt.where(ForumEmbedding.course_id == course_id)

    result = await session.execute(stmt)
    rows = result.all()

    return [
        {
            "thread_id": row.thread_id,
            "course_id": row.course_id,
            "cluster_id": row.cluster_id,
            "title": row.title,
            "content": row.content,
            "_score": _cosine_similarity(row.distance),
        }
        for row in rows
    ]
