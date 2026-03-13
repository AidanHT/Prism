"""Shared FastAPI dependency functions (database session, mock auth)."""
from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.user import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an AsyncSession for each request.

    Commits on clean exit; rolls back and re-raises on any unhandled exception.
    The ``async with`` context manager always closes the underlying connection.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except SQLAlchemyError:
            await session.rollback()
            raise


async def get_current_user(
    x_user_id: UUID = Header(
        ...,
        description="Simulated Cognito sub – the authenticated user's UUID.",
    ),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    MVP mock authentication dependency.

    Reads the ``X-User-Id`` request header and returns the corresponding
    ``User`` row.  Replace with real Cognito JWT verification before deploying
    to production.
    """
    result = await db.execute(select(User).where(User.id == x_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found – verify the X-User-Id header value.",
        )
    return user
