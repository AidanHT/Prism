"""Shared FastAPI dependency functions (DynamoDB auth)."""
from __future__ import annotations

from typing import Any

from fastapi import Header, HTTPException, status

from app.db.dynamo import dynamo_manager


async def get_current_user(
    x_user_id: str = Header(
        ...,
        description="Simulated Cognito sub -- the authenticated user's UUID.",
    ),
) -> dict[str, Any]:
    """
    MVP mock authentication dependency.

    Reads the ``X-User-Id`` request header and returns the corresponding
    user dict from DynamoDB.  Replace with real Cognito JWT verification
    before deploying to production.
    """
    user = await dynamo_manager.get_user(x_user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found -- verify the X-User-Id header value.",
        )
    return user
