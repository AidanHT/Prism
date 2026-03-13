"""Messages microservice router – direct messaging between users.

Each ``Message`` row is a standalone message.  Threads are grouped by subject
on the client.  Replies create a new ``Message`` with the same subject and
automatically notify all original participants.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.models.message import Message, MessageRecipient
from app.models.user import User
from app.schemas.messages import MessageCreate, MessageResponse
from app.sockets import emit_new_message

router = APIRouter(tags=["messages"])


@router.get("/messages", response_model=list[MessageResponse])
async def list_messages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Message]:
    """Return all messages where the current user is sender or recipient."""
    sent_result = await db.execute(
        select(Message).where(Message.sender_id == current_user.id)
    )
    recv_result = await db.execute(
        select(Message)
        .join(MessageRecipient, MessageRecipient.message_id == Message.id)
        .where(MessageRecipient.recipient_id == current_user.id)
    )
    sent = list(sent_result.scalars().all())
    recv = list(recv_result.scalars().all())

    # Merge and deduplicate, newest first.
    seen: set[UUID] = set()
    merged: list[Message] = []
    for msg in sorted(sent + recv, key=lambda m: m.created_at, reverse=True):
        if msg.id not in seen:
            seen.add(msg.id)
            merged.append(msg)
    return merged


@router.post(
    "/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    """Send a new message to one or more recipients."""
    message = Message(
        sender_id=current_user.id,
        subject=payload.subject,
        body=payload.body,
        course_id=payload.course_id,
    )
    db.add(message)
    await db.flush()  # resolve message.id before adding recipients

    for rid in payload.recipient_ids:
        db.add(MessageRecipient(message_id=message.id, recipient_id=rid))

    await db.flush()
    await db.refresh(message)

    # Push real-time events to each recipient.
    for rid in payload.recipient_ids:
        await emit_new_message(
            str(rid),
            {
                "id": str(message.id),
                "subject": message.subject,
                "sender": current_user.name,
            },
        )

    return message


@router.get("/messages/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    """Retrieve a single message by ID."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
    return message


@router.post(
    "/messages/{message_id}/reply",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def reply_to_message(
    message_id: UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    """Reply to an existing message.

    Creates a new Message with the same subject and notifies all original
    participants (sender + recipients) except the replying user.
    """
    orig_result = await db.execute(select(Message).where(Message.id == message_id))
    original = orig_result.scalar_one_or_none()
    if original is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")

    reply = Message(
        sender_id=current_user.id,
        subject=original.subject,
        body=payload.body,
        course_id=original.course_id,
    )
    db.add(reply)
    await db.flush()

    # Collect all participants from original thread, excluding self.
    notify_ids: set[UUID] = {original.sender_id}
    for r in original.recipients:
        notify_ids.add(r.recipient_id)
    notify_ids.discard(current_user.id)

    for rid in notify_ids:
        db.add(MessageRecipient(message_id=reply.id, recipient_id=rid))
        await emit_new_message(
            str(rid),
            {
                "id": str(reply.id),
                "subject": reply.subject,
                "sender": current_user.name,
            },
        )

    await db.flush()
    await db.refresh(reply)
    return reply


@router.patch("/messages/{message_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_message_read(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Mark the current user's recipient record for a message as read."""
    from datetime import datetime, timezone

    result = await db.execute(
        select(MessageRecipient).where(
            MessageRecipient.message_id == message_id,
            MessageRecipient.recipient_id == current_user.id,
        )
    )
    recipient = result.scalar_one_or_none()
    if recipient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient record not found.",
        )
    recipient.read_at = datetime.now(timezone.utc)
    await db.flush()
