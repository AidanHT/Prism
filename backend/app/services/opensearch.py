"""OpenSearch service – vector embeddings and k-NN semantic search.

Integrates with Amazon Titan Embeddings V2 (via Bedrock) to generate
1536-dimensional vectors and indexes forum thread documents into an
OpenSearch Serverless Vector Engine index (``prism-forum-embeddings``).

All blocking I/O (Boto3 + OpenSearch HTTP) is offloaded to the default
thread-pool executor so it does not stall the FastAPI event loop.
"""

from __future__ import annotations

import asyncio
import json
from functools import partial
from typing import Any

import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

from app.core.config import settings
from app.services.bedrock import get_bedrock_client

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EMBEDDING_MODEL_ID: str = "amazon.titan-embed-text-v2:0"
_VECTOR_DIMENSION: int = 1536

# ---------------------------------------------------------------------------
# Lazy OpenSearch client singleton
# ---------------------------------------------------------------------------

_os_client: OpenSearch | None = None


def get_opensearch_client() -> OpenSearch:
    """Return a lazily-initialised OpenSearch client (singleton).

    When OPENSEARCH_SERVERLESS is True, uses IAM SigV4 (service='aoss') instead
    of basic auth. For local/self-managed OpenSearch, uses username/password.
    """
    global _os_client
    if _os_client is None:
        if settings.OPENSEARCH_SERVERLESS:
            credentials = boto3.Session().get_credentials()
            if credentials is None:
                raise RuntimeError(
                    "OpenSearch Serverless requires AWS credentials; none found"
                )
            auth = AWS4Auth(
                credentials.access_key,
                credentials.secret_key,
                settings.AWS_REGION,
                "aoss",
                session_token=credentials.token,
            )
            _os_client = OpenSearch(
                hosts=[{"host": settings.OPENSEARCH_HOST, "port": 443}],
                http_auth=auth,
                use_ssl=True,
                verify_certs=True,
                connection_class=RequestsHttpConnection,
            )
        else:
            _os_client = OpenSearch(
                hosts=[
                    {
                        "host": settings.OPENSEARCH_HOST,
                        "port": settings.OPENSEARCH_PORT,
                    }
                ],
                http_auth=(
                    settings.OPENSEARCH_USERNAME,
                    settings.OPENSEARCH_PASSWORD,
                ),
                use_ssl=settings.OPENSEARCH_USE_SSL,
                verify_certs=False,
                connection_class=RequestsHttpConnection,
            )
    return _os_client


# ---------------------------------------------------------------------------
# Embeddings pipeline
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
            "dimensions": _VECTOR_DIMENSION,
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
# Indexing
# ---------------------------------------------------------------------------


def _index_document_sync(
    index: str,
    doc_id: str,
    document: dict[str, Any],
) -> str:
    """Index *document* into OpenSearch with *doc_id* as the ``_id``."""
    client = get_opensearch_client()
    response: dict[str, Any] = client.index(
        index=index,
        id=doc_id,
        body=document,
        refresh=True,  # make immediately searchable (relaxed in production)
    )
    return response["_id"]  # type: ignore[return-value]


async def index_forum_thread(
    *,
    thread_id: str,
    course_id: str,
    cluster_id: str | None,
    title: str,
    content: str,
) -> str:
    """Embed *title + content* and index the thread document into OpenSearch.

    The combined ``title\\n\\ncontent`` string is embedded so that both the
    subject and the body contribute to the vector representation.

    Returns:
        The OpenSearch document ``_id``, which equals *thread_id*.
    """
    combined_text = f"{title}\n\n{content}"
    vector = await embed_text(combined_text)

    document: dict[str, Any] = {
        "thread_id": thread_id,
        "course_id": course_id,
        "cluster_id": cluster_id,
        "title": title,
        "content": content,
        "embedding": vector,
    }

    loop = asyncio.get_running_loop()
    doc_id: str = await loop.run_in_executor(
        None,
        partial(
            _index_document_sync,
            settings.OPENSEARCH_FORUM_INDEX,
            thread_id,
            document,
        ),
    )
    return doc_id


# ---------------------------------------------------------------------------
# Semantic k-NN search
# ---------------------------------------------------------------------------


def _search_sync(
    index: str,
    query_body: dict[str, Any],
) -> dict[str, Any]:
    """Execute an OpenSearch search request synchronously."""
    client = get_opensearch_client()
    return client.search(index=index, body=query_body)  # type: ignore[return-value]


async def search_similar_threads(
    question: str,
    *,
    k: int = 5,
    course_id: str | None = None,
) -> list[dict[str, Any]]:
    """Semantic k-NN search: find forum threads conceptually similar to *question*.

    Embeds *question* with Titan and issues an exact OpenSearch k-NN JSON
    query against the ``embedding`` field.  When *course_id* is supplied, a
    ``post_filter`` restricts results to that course without affecting the
    k-NN scoring phase.

    Args:
        question: The student's natural-language question.
        k: Number of nearest-neighbour results to return (1–20).
        course_id: Optional course UUID to scope results.

    Returns:
        A list of hit source dicts, each containing ``thread_id``,
        ``course_id``, ``cluster_id``, ``title``, ``content``, and
        ``_score``.
    """
    query_vector = await embed_text(question)

    # Exact OpenSearch k-NN query payload expected by the Vector Engine plugin.
    knn_query: dict[str, Any] = {
        "size": k,
        "query": {
            "knn": {
                "embedding": {
                    "vector": query_vector,
                    "k": k,
                }
            }
        },
        "_source": ["thread_id", "course_id", "cluster_id", "title", "content"],
    }

    # post_filter applies after k-NN scoring so the vector distance is not
    # affected by the course scoping.
    if course_id is not None:
        knn_query["post_filter"] = {"term": {"course_id": course_id}}

    loop = asyncio.get_running_loop()
    response: dict[str, Any] = await loop.run_in_executor(
        None,
        partial(_search_sync, settings.OPENSEARCH_FORUM_INDEX, knn_query),
    )

    hits: list[dict[str, Any]] = []
    for hit in response["hits"]["hits"]:
        source: dict[str, Any] = hit["_source"]
        source["_score"] = hit["_score"]
        hits.append(source)

    return hits


# ---------------------------------------------------------------------------
# Authoritative knowledge-base upsert (Add to Brain)
# ---------------------------------------------------------------------------


async def upsert_authoritative_document(
    *,
    thread_id: str,
    course_id: str,
    cluster_id: str | None,
    title: str,
    content: str,
) -> str:
    """Embed *title + content* and upsert the document as authoritative.

    Marks the document with ``is_authoritative: True`` so it can be
    exclusively targeted by the TA tone checker.  Using the *thread_id*
    as ``_id`` makes this call idempotent — repeated calls simply
    overwrite the previous version.

    Returns:
        The OpenSearch document ``_id``, equal to *thread_id*.
    """
    combined_text = f"{title}\n\n{content}"
    vector = await embed_text(combined_text)

    document: dict[str, Any] = {
        "thread_id": thread_id,
        "course_id": course_id,
        "cluster_id": cluster_id,
        "title": title,
        "content": content,
        "embedding": vector,
        "is_authoritative": True,
    }

    loop = asyncio.get_running_loop()
    doc_id: str = await loop.run_in_executor(
        None,
        partial(
            _index_document_sync,
            settings.OPENSEARCH_FORUM_INDEX,
            thread_id,
            document,
        ),
    )
    return doc_id


# ---------------------------------------------------------------------------
# Authoritative k-NN search (TA tone checker context)
# ---------------------------------------------------------------------------


async def search_authoritative_threads(
    question: str,
    *,
    k: int = 5,
    course_id: str | None = None,
) -> list[dict[str, Any]]:
    """k-NN search restricted to professor/TA-approved (authoritative) documents.

    Identical to :func:`search_similar_threads` but adds an
    ``is_authoritative: true`` term filter so only knowledge-base entries
    created via the *Add to Brain* workflow are returned.
    """
    query_vector = await embed_text(question)

    knn_query: dict[str, Any] = {
        "size": k,
        "query": {
            "knn": {
                "embedding": {
                    "vector": query_vector,
                    "k": k,
                }
            }
        },
        "_source": ["thread_id", "course_id", "cluster_id", "title", "content"],
    }

    # Combine course_id scoping and authoritative filter in a single bool must.
    must_clauses: list[dict[str, Any]] = [{"term": {"is_authoritative": True}}]
    if course_id is not None:
        must_clauses.append({"term": {"course_id": course_id}})

    knn_query["post_filter"] = {"bool": {"must": must_clauses}}

    loop = asyncio.get_running_loop()
    response: dict[str, Any] = await loop.run_in_executor(
        None,
        partial(_search_sync, settings.OPENSEARCH_FORUM_INDEX, knn_query),
    )

    hits: list[dict[str, Any]] = []
    for hit in response["hits"]["hits"]:
        source: dict[str, Any] = hit["_source"]
        source["_score"] = hit["_score"]
        hits.append(source)

    return hits
