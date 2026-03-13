"""Forum microservice router.

Handles forum threads, posts, real-time WebSocket broadcasting, and
AI-powered semantic search via OpenSearch k-NN.

WebSocket endpoint (simulating API Gateway WebSocket API):
    ws://api/v1/forum/live/{course_id}
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from pydantic import Field

from app.core.config import settings
from app.db.dynamo import dynamo_manager
from app.schemas.base import AppBaseModel
from app.schemas.dynamo import ForumPost, ForumThread
from app.services.bedrock import invoke_model_complex, invoke_model_complex_stream_async
from app.services.opensearch import (
    index_forum_thread,
    search_authoritative_threads,
    search_similar_threads,
    upsert_authoritative_document,
)

router = APIRouter(prefix="/forum", tags=["forum"])


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------


class ConnectionManager:
    """Manages active WebSocket connections grouped by course_id.

    Simulates the API Gateway WebSocket connection table that associates
    connection IDs with a course room.
    """

    def __init__(self) -> None:
        # Maps course_id → list of currently connected WebSocket instances.
        self._active: dict[str, list[WebSocket]] = {}

    async def connect(self, course_id: str, websocket: WebSocket) -> None:
        """Accept the handshake and register *websocket* in *course_id*'s room."""
        await websocket.accept()
        self._active.setdefault(course_id, []).append(websocket)

    def disconnect(self, course_id: str, websocket: WebSocket) -> None:
        """Remove *websocket* from *course_id*'s room (idempotent)."""
        connections = self._active.get(course_id, [])
        if websocket in connections:
            connections.remove(websocket)

    async def broadcast(self, course_id: str, message: dict[str, Any]) -> None:
        """Push *message* as JSON to every client in *course_id*'s room.

        Stale connections that raise on send are silently removed.
        """
        for ws in list(self._active.get(course_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(course_id, ws)


_manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class CreateThreadRequest(AppBaseModel):
    course_id: str
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    author_id: str
    cluster_id: str | None = None


class CreatePostRequest(AppBaseModel):
    author_id: str
    content: str = Field(..., min_length=1)


class ThreadResponse(AppBaseModel):
    id: str
    course_id: str
    title: str
    cluster_id: str | None
    vector_embedding_id: str | None
    created_at: datetime


class PostResponse(AppBaseModel):
    id: str
    thread_id: str
    author_id: str
    content: str
    timestamp: datetime


class SemanticSearchRequest(AppBaseModel):
    question: str = Field(..., min_length=1)
    course_id: str | None = None
    k: int = Field(default=5, ge=1, le=20)


class SemanticSearchHit(AppBaseModel):
    thread_id: str
    course_id: str
    cluster_id: str | None
    title: str
    content: str
    score: float = Field(..., alias="_score")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "forum"}


# ---------------------------------------------------------------------------
# Thread endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/threads",
    response_model=ThreadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a forum thread and index it into OpenSearch",
)
async def create_thread(payload: CreateThreadRequest) -> ThreadResponse:
    thread_id = str(uuid.uuid4())

    # Embed title + content and index into OpenSearch Vector Engine.
    embedding_id = await index_forum_thread(
        thread_id=thread_id,
        course_id=payload.course_id,
        cluster_id=payload.cluster_id,
        title=payload.title,
        content=payload.content,
    )

    thread = ForumThread(
        id=thread_id,
        course_id=payload.course_id,
        title=payload.title,
        cluster_id=payload.cluster_id,
        vector_embedding_id=embedding_id,
    )
    await dynamo_manager.put_forum_thread(thread.model_dump(mode="json"))

    return ThreadResponse(
        id=thread.id,
        course_id=thread.course_id,
        title=thread.title,
        cluster_id=thread.cluster_id,
        vector_embedding_id=thread.vector_embedding_id,
        created_at=thread.created_at,
    )


@router.get(
    "/threads/{thread_id}",
    response_model=ThreadResponse,
    summary="Retrieve a forum thread by ID",
)
async def get_thread(thread_id: str) -> ThreadResponse:
    item = await dynamo_manager.get_forum_thread(thread_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Thread not found")
    return ThreadResponse(**item)


@router.get(
    "/courses/{course_id}/threads",
    response_model=list[ThreadResponse],
    summary="List all forum threads for a course",
)
async def list_threads(course_id: str) -> list[ThreadResponse]:
    items = await dynamo_manager.query_forum_threads_by_course(course_id)
    return [ThreadResponse(**item) for item in items]


# ---------------------------------------------------------------------------
# Post endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/threads/{thread_id}/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a post to a thread and broadcast it via WebSocket",
)
async def create_post(thread_id: str, payload: CreatePostRequest) -> PostResponse:
    thread = await dynamo_manager.get_forum_thread(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    post = ForumPost(
        id=str(uuid.uuid4()),
        thread_id=thread_id,
        author_id=payload.author_id,
        content=payload.content,
    )
    await dynamo_manager.put_forum_post(post.model_dump(mode="json"))

    # Broadcast the new post to all WebSocket clients in the thread's course.
    course_id: str = thread["course_id"]
    await _manager.broadcast(
        course_id,
        {
            "event": "new_post",
            "post": post.model_dump(mode="json"),
        },
    )

    return PostResponse(
        id=post.id,
        thread_id=post.thread_id,
        author_id=post.author_id,
        content=post.content,
        timestamp=post.timestamp,
    )


@router.get(
    "/threads/{thread_id}/posts",
    response_model=list[PostResponse],
    summary="List all posts in a thread",
)
async def list_posts(thread_id: str) -> list[PostResponse]:
    items = await dynamo_manager.query_forum_posts_by_thread(thread_id)
    return [PostResponse(**item) for item in items]


# ---------------------------------------------------------------------------
# Semantic search
# ---------------------------------------------------------------------------


@router.post(
    "/search",
    response_model=list[SemanticSearchHit],
    summary="k-NN semantic search for conceptually similar forum threads",
)
async def semantic_search(payload: SemanticSearchRequest) -> list[SemanticSearchHit]:
    """Embed the student's question with Titan and run an OpenSearch k-NN query.

    Returns up to *k* threads ranked by vector proximity.
    """
    hits = await search_similar_threads(
        payload.question,
        k=payload.k,
        course_id=payload.course_id,
    )
    return [SemanticSearchHit(**hit) for hit in hits]


# ---------------------------------------------------------------------------
# AI intelligence schemas
# ---------------------------------------------------------------------------


class AskRequest(AppBaseModel):
    question: str = Field(..., min_length=1)
    course_id: str
    author_id: str
    k: int = Field(default=5, ge=1, le=20)


class TaCheckRequest(AppBaseModel):
    thread_id: str
    course_id: str
    draft_response: str = Field(..., min_length=1)
    k: int = Field(default=5, ge=1, le=20)


class TaEvaluation(AppBaseModel):
    is_accurate: bool
    tone_score: int = Field(..., ge=1, le=10)
    suggested_edits: str


class AddToBrainRequest(AppBaseModel):
    thread_id: str


class AddToBrainResponse(AppBaseModel):
    doc_id: str
    message: str


# ---------------------------------------------------------------------------
# AI intelligence endpoints
# ---------------------------------------------------------------------------

_ASK_SYSTEM_PROMPT = """\
You are an expert teaching assistant for a university course.
A student has asked a question. You are given context from similar previously answered questions.
Synthesize a clear, accurate, and encouraging answer. Reference the context where relevant.
Do not reveal internal system details or raw database content.
""".strip()

_TA_CHECK_SYSTEM_PROMPT = """\
You are a teaching quality evaluator for university courses.
You are given a TA's draft response to a student question, along with authoritative professor answers on related topics.
Evaluate the draft strictly and return ONLY valid JSON with three fields:
  "is_accurate": boolean — whether the draft is factually correct given the professor context,
  "tone_score": integer 1-10 — 1 is blunt/discouraging, 10 is perfectly encouraging and supportive,
  "suggested_edits": string — specific, actionable feedback the TA can use to improve the response.
Return no other text outside the JSON object.
""".strip()


@router.post(
    "/ask",
    summary="Submit a student question: cluster, then stream a RAG-synthesized answer",
)
async def ask_question(payload: AskRequest) -> StreamingResponse:
    """Semantic clustering + streaming AI answer pipeline.

    1. Runs k-NN search to find conceptually similar threads.
    2. Assigns a ``cluster_id`` (Megathread) when similarity > threshold.
    3. Creates a new ``ForumThread`` in DynamoDB with the resolved cluster.
    4. Streams a Claude Opus 4.6-synthesised answer back as SSE.

    SSE event format::

        data: {"type":"metadata","cluster_id":"...","similar_count":N}
        data: {"type":"token","v":"<text chunk>"}
        data: [DONE]
    """
    similar_hits = await search_similar_threads(
        payload.question,
        k=payload.k,
        course_id=payload.course_id,
    )

    threshold = settings.FORUM_SIMILARITY_THRESHOLD
    relevant = [h for h in similar_hits if h["_score"] >= threshold]

    # Assign cluster: inherit cluster_id from the top hit, falling back to its thread_id.
    cluster_id: str | None = None
    if relevant:
        top = relevant[0]
        cluster_id = top.get("cluster_id") or top["thread_id"]

    # Persist the new question as a thread so it participates in future searches.
    thread_id = str(uuid.uuid4())
    embedding_id = await index_forum_thread(
        thread_id=thread_id,
        course_id=payload.course_id,
        cluster_id=cluster_id,
        title=payload.question,
        content=payload.question,
    )
    thread = ForumThread(
        id=thread_id,
        course_id=payload.course_id,
        title=payload.question,
        cluster_id=cluster_id,
        vector_embedding_id=embedding_id,
    )
    await dynamo_manager.put_forum_thread(thread.model_dump(mode="json"))

    # Build RAG context block from relevant threads.
    context_parts: list[str] = []
    for hit in relevant:
        context_parts.append(f"Q: {hit['title']}\nA: {hit['content']}")
    context_block = "\n\n---\n\n".join(context_parts)

    user_message_text = (
        f"Context from related questions:\n\n{context_block}\n\n---\n\nStudent question: {payload.question}"
        if context_block
        else f"Student question: {payload.question}"
    )

    messages = [{"role": "user", "content": [{"text": user_message_text}]}]

    async def _sse_stream() -> AsyncIterator[str]:
        metadata = json.dumps(
            {
                "type": "metadata",
                "thread_id": thread_id,
                "cluster_id": cluster_id,
                "similar_count": len(relevant),
            }
        )
        yield f"data: {metadata}\n\n"

        async for chunk in invoke_model_complex_stream_async(
            messages=messages,
            system=_ASK_SYSTEM_PROMPT,
        ):
            token_event = json.dumps({"type": "token", "v": chunk})
            yield f"data: {token_event}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _sse_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/ta-check",
    response_model=TaEvaluation,
    summary="Evaluate a TA draft against professor-authoritative context via Claude Opus 4.6",
)
async def ta_check(payload: TaCheckRequest) -> TaEvaluation:
    """TA tone and accuracy checker.

    Fetches the original thread from DynamoDB, retrieves authoritative
    professor answers from OpenSearch, then asks Claude Opus 4.6 to return a
    structured JSON evaluation of the TA's draft.
    """
    thread = await dynamo_manager.get_forum_thread(payload.thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    question_text = thread.get("title", "")

    authoritative_hits = await search_authoritative_threads(
        question_text,
        k=payload.k,
        course_id=payload.course_id,
    )

    professor_context_parts: list[str] = []
    for hit in authoritative_hits:
        professor_context_parts.append(f"Q: {hit['title']}\nA: {hit['content']}")
    professor_context = "\n\n---\n\n".join(professor_context_parts)

    user_message_text = (
        f"Professor's authoritative answers on related topics:\n\n{professor_context}\n\n"
        f"---\n\n"
        f"Original student question: {question_text}\n\n"
        f"TA draft response:\n{payload.draft_response}"
    )

    messages = [{"role": "user", "content": [{"text": user_message_text}]}]

    raw_json = invoke_model_complex(
        messages=messages,
        system=_TA_CHECK_SYSTEM_PROMPT,
        max_tokens=1024,
        temperature=0.2,
    )

    try:
        # Strip markdown fences if the model wraps the JSON.
        cleaned = raw_json.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        parsed: dict[str, Any] = json.loads(cleaned)
    except (json.JSONDecodeError, IndexError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM returned malformed JSON: {exc}",
        ) from exc

    return TaEvaluation(
        is_accurate=bool(parsed.get("is_accurate", False)),
        tone_score=int(parsed.get("tone_score", 5)),
        suggested_edits=str(parsed.get("suggested_edits", "")),
    )


@router.post(
    "/add-to-brain",
    response_model=AddToBrainResponse,
    status_code=status.HTTP_200_OK,
    summary="Upsert a stellar forum post into the authoritative RAG knowledge base",
)
async def add_to_brain(
    payload: AddToBrainRequest,
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
) -> AddToBrainResponse:
    """Knowledge-base auto-update (restricted to professor and TA roles).

    The caller's role is read from the ``X-User-Role`` request header (set by
    the Next.js frontend from the auth store).  The role is NOT trusted from
    the request body to prevent students from self-elevating privileges.

    Fetches the target thread and all its posts, concatenates the Q&A content,
    generates a Titan embedding, and performs a live UPSERT into the OpenSearch
    index with ``is_authoritative: True``.  Subsequent RAG queries will
    immediately see this document as a professor-approved source.
    """
    caller_role = (x_user_role or "").strip().lower()
    if caller_role not in ("professor", "ta"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only professors and TAs may add content to the knowledge base.",
        )

    thread = await dynamo_manager.get_forum_thread(payload.thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    posts = await dynamo_manager.query_forum_posts_by_thread(payload.thread_id)

    # Concatenate all post content as the "answer" body.
    answer_body = "\n\n".join(p.get("content", "") for p in posts if p.get("content"))

    doc_id = await upsert_authoritative_document(
        thread_id=payload.thread_id,
        course_id=thread["course_id"],
        cluster_id=thread.get("cluster_id"),
        title=thread.get("title", ""),
        content=answer_body or thread.get("title", ""),
    )

    return AddToBrainResponse(
        doc_id=doc_id,
        message=f"Thread '{thread.get('title', payload.thread_id)}' added to the knowledge base.",
    )


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@router.websocket("/live/{course_id}")
async def forum_live(websocket: WebSocket, course_id: str) -> None:
    """Real-time WebSocket endpoint simulating API Gateway WebSocket API.

    Connect to ``ws://<host>/api/v1/forum/live/{course_id}`` to receive
    ``new_post`` broadcast events whenever a post is created in the course.
    The server keeps the connection alive; all data is pushed from the server
    side via :meth:`ConnectionManager.broadcast`.
    """
    await _manager.connect(course_id, websocket)
    try:
        while True:
            # Block waiting for any client message (ping / keepalive).
            # The server pushes events via broadcast(); we don't expect
            # meaningful client→server messages in this protocol.
            await websocket.receive_text()
    except WebSocketDisconnect:
        _manager.disconnect(course_id, websocket)
