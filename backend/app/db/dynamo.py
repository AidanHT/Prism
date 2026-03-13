"""DynamoDB resource manager with async-compatible wrapper methods.

Boto3 is synchronous; all blocking calls are offloaded to a thread-pool
executor via ``asyncio.get_running_loop().run_in_executor`` so they do not
stall the FastAPI event loop.
"""
from __future__ import annotations

import asyncio
from functools import partial
from typing import TYPE_CHECKING, Any

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

if TYPE_CHECKING:
    from mypy_boto3_dynamodb.service_resource import DynamoDBServiceResource, Table


class DynamoDBManager:
    """Singleton-style manager that lazily initialises the Boto3 DynamoDB
    resource and exposes async-compatible ``put_item``, ``get_item``, and
    ``query`` helpers for the three Prism tables.
    """

    def __init__(self) -> None:
        self._resource: DynamoDBServiceResource | None = None

    # ── Private helpers ──────────────────────────────────────────────────────

    def _get_resource(self) -> DynamoDBServiceResource:
        if self._resource is None:
            kwargs: dict[str, object] = {
                "region_name": settings.AWS_REGION,
            }
            if settings.AWS_ACCESS_KEY_ID:
                kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            if settings.AWS_SECRET_ACCESS_KEY:
                kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
            if settings.AWS_SESSION_TOKEN:
                kwargs["aws_session_token"] = settings.AWS_SESSION_TOKEN
            if settings.DYNAMODB_ENDPOINT_URL:
                kwargs["endpoint_url"] = settings.DYNAMODB_ENDPOINT_URL
            self._resource = boto3.resource("dynamodb", **kwargs)  # type: ignore[call-overload]
        return self._resource

    def _table(self, table_name: str) -> Table:
        return self._get_resource().Table(table_name)  # type: ignore[return-value]

    async def _run_sync(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
        """Run a blocking callable in the default thread-pool executor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, partial(fn, *args, **kwargs))

    # ── Public API ───────────────────────────────────────────────────────────

    async def put_item(
        self,
        table_name: str,
        item: dict[str, Any],
    ) -> dict[str, Any]:
        """Write (or overwrite) a single item to *table_name*.

        Returns the raw Boto3 response dict.
        """
        table = self._table(table_name)
        return await self._run_sync(table.put_item, Item=item)

    async def get_item(
        self,
        table_name: str,
        key: dict[str, Any],
    ) -> dict[str, Any] | None:
        """Retrieve a single item by its primary key.

        Returns the item dict if found, or ``None`` if the key does not exist.
        """
        table = self._table(table_name)
        response = await self._run_sync(table.get_item, Key=key)
        return response.get("Item")  # type: ignore[return-value]

    async def query(
        self,
        table_name: str,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """Execute a DynamoDB Query and return all matching items.

        Pass any valid Boto3 ``Table.query`` keyword arguments (e.g.
        ``IndexName``, ``KeyConditionExpression``, ``FilterExpression``).
        """
        table = self._table(table_name)
        response = await self._run_sync(table.query, **kwargs)
        return response.get("Items", [])  # type: ignore[return-value]

    # ── Convenience wrappers ─────────────────────────────────────────────────

    async def put_forum_thread(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_FORUM, item)

    async def get_forum_thread(self, thread_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_FORUM, {"id": thread_id})

    async def query_forum_threads_by_course(
        self, course_id: str
    ) -> list[dict[str, Any]]:
        from boto3.dynamodb.conditions import Key  # local import to avoid cold-start overhead
        return await self.query(
            settings.DYNAMODB_TABLE_FORUM,
            IndexName="course_id-index",
            KeyConditionExpression=Key("course_id").eq(course_id),
        )

    async def put_forum_post(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_FORUM_POSTS, item)

    async def get_forum_post(self, post_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_FORUM_POSTS, {"id": post_id})

    async def query_forum_posts_by_thread(
        self, thread_id: str
    ) -> list[dict[str, Any]]:
        from boto3.dynamodb.conditions import Key
        return await self.query(
            settings.DYNAMODB_TABLE_FORUM_POSTS,
            IndexName="thread_id-index",
            KeyConditionExpression=Key("thread_id").eq(thread_id),
        )

    async def put_chat_session(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_SESSIONS, item)

    async def get_chat_session(self, session_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_SESSIONS, {"session_id": session_id})

    async def query_chat_sessions_by_user(
        self, user_id: str
    ) -> list[dict[str, Any]]:
        from boto3.dynamodb.conditions import Key
        return await self.query(
            settings.DYNAMODB_TABLE_SESSIONS,
            IndexName="user_id-index",
            KeyConditionExpression=Key("user_id").eq(user_id),
        )


# Module-level singleton used throughout the application.
dynamo_manager = DynamoDBManager()
