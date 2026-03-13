"""Discussions microservice router.

Handles course discussion threads and threaded replies (stored in PostgreSQL).
This is separate from the DynamoDB-backed AI forum in forum.py.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db
from app.models.course import Course
from app.models.discussion import Discussion, DiscussionReply
from app.models.user import User
from app.schemas.discussions import (
    DiscussionCreate,
    DiscussionReplyCreate,
    DiscussionReplyResponse,
    DiscussionReplyUpdate,
    DiscussionResponse,
    DiscussionUpdate,
)

router = APIRouter(tags=["discussions"])


# ── Discussion CRUD ───────────────────────────────────────────────────────────

@router.get("/courses/{course_id}/discussions", response_model=list[DiscussionResponse])
async def list_discussions(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Discussion]:
    """List all discussion threads for a course, pinned first."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    result = await db.execute(
        select(Discussion)
        .where(Discussion.course_id == course_id)
        .order_by(Discussion.is_pinned.desc(), Discussion.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/courses/{course_id}/discussions",
    response_model=DiscussionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_discussion(
    course_id: UUID,
    payload: DiscussionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Discussion:
    """Create a new discussion thread in a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    discussion = Discussion(**payload.model_dump())
    db.add(discussion)
    await db.flush()
    await db.refresh(discussion)
    return discussion


@router.get("/discussions/{discussion_id}", response_model=DiscussionResponse)
async def get_discussion(
    discussion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Discussion:
    """Retrieve a discussion thread by ID."""
    result = await db.execute(
        select(Discussion).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if discussion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    return discussion


@router.put("/discussions/{discussion_id}", response_model=DiscussionResponse)
async def update_discussion(
    discussion_id: UUID,
    payload: DiscussionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Discussion:
    """Update a discussion thread (title, body, pin/lock state)."""
    result = await db.execute(
        select(Discussion).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if discussion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(discussion, field, value)
    await db.flush()
    await db.refresh(discussion)
    return discussion


@router.delete("/discussions/{discussion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_discussion(
    discussion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a discussion thread and all its replies."""
    result = await db.execute(
        select(Discussion).where(Discussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if discussion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    await db.delete(discussion)


# ── Reply CRUD ────────────────────────────────────────────────────────────────

@router.get(
    "/discussions/{discussion_id}/replies",
    response_model=list[DiscussionReplyResponse],
)
async def list_replies(
    discussion_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DiscussionReply]:
    """
    List top-level replies for a discussion, oldest first.

    Child replies are accessible via the ``parent_reply_id`` field; clients
    can build a tree client-side from this flat list.
    """
    disc_row = await db.execute(
        select(Discussion).where(Discussion.id == discussion_id)
    )
    if disc_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    result = await db.execute(
        select(DiscussionReply)
        .where(DiscussionReply.discussion_id == discussion_id)
        .order_by(DiscussionReply.created_at.asc())
    )
    return list(result.scalars().all())


@router.post(
    "/discussions/{discussion_id}/replies",
    response_model=DiscussionReplyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reply(
    discussion_id: UUID,
    payload: DiscussionReplyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DiscussionReply:
    """Post a reply to a discussion thread (optionally nested under a parent reply)."""
    disc_row = await db.execute(
        select(Discussion).where(Discussion.id == discussion_id)
    )
    discussion = disc_row.scalar_one_or_none()
    if discussion is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found.")
    if discussion.is_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This discussion is locked and no longer accepts replies.",
        )
    reply = DiscussionReply(**payload.model_dump())
    db.add(reply)
    await db.flush()
    await db.refresh(reply)
    return reply


@router.put("/replies/{reply_id}", response_model=DiscussionReplyResponse)
async def update_reply(
    reply_id: UUID,
    payload: DiscussionReplyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DiscussionReply:
    """Edit the body of a discussion reply."""
    result = await db.execute(
        select(DiscussionReply).where(DiscussionReply.id == reply_id)
    )
    reply = result.scalar_one_or_none()
    if reply is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reply, field, value)
    await db.flush()
    await db.refresh(reply)
    return reply


@router.delete("/replies/{reply_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reply(
    reply_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a discussion reply (and orphan any child replies)."""
    result = await db.execute(
        select(DiscussionReply).where(DiscussionReply.id == reply_id)
    )
    reply = result.scalar_one_or_none()
    if reply is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reply not found.")
    await db.delete(reply)
