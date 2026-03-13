"""Local-development script: create all Prism DynamoDB tables.

Run from the ``backend/`` directory after starting DynamoDB Local:

    docker run -p 8000:8000 amazon/dynamodb-local
    python create_dynamodb_tables.py

The script is idempotent - it silently skips tables that already exist.
Set ``DYNAMODB_ENDPOINT_URL=http://localhost:8000`` in your ``.env`` (or
export it) to target DynamoDB Local instead of AWS.
"""
from __future__ import annotations

import sys

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings


def _client() -> "boto3.client":  # type: ignore[name-defined]
    kwargs: dict[str, object] = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
    if settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    if settings.AWS_SESSION_TOKEN:
        kwargs["aws_session_token"] = settings.AWS_SESSION_TOKEN
    if settings.DYNAMODB_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.DYNAMODB_ENDPOINT_URL
    return boto3.client("dynamodb", **kwargs)  # type: ignore[return-value]


def _create_table(client: "boto3.client", **kwargs: object) -> None:  # type: ignore[name-defined]
    table_name = kwargs["TableName"]
    try:
        client.create_table(**kwargs)  # type: ignore[arg-type]
        print(f"  Created table: {table_name}")
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ResourceInUseException":
            print(f"  Table already exists (skipped): {table_name}")
        else:
            raise


def create_forum_threads_table(client: "boto3.client") -> None:  # type: ignore[name-defined]
    """``prism-forum``: ForumThread documents.

    PK: ``id`` (String)
    GSI: ``course_id-index`` – query threads by course.
    """
    _create_table(
        client,
        TableName=settings.DYNAMODB_TABLE_FORUM,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "course_id", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "id", "KeyType": "HASH"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "course_id-index",
                "KeySchema": [
                    {"AttributeName": "course_id", "KeyType": "HASH"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    )


def create_forum_posts_table(client: "boto3.client") -> None:  # type: ignore[name-defined]
    """``prism-forum-posts``: ForumPost documents.

    PK: ``id`` (String)
    GSI: ``thread_id-index`` – query posts by thread.
    """
    _create_table(
        client,
        TableName=settings.DYNAMODB_TABLE_FORUM_POSTS,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "id", "AttributeType": "S"},
            {"AttributeName": "thread_id", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "id", "KeyType": "HASH"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "thread_id-index",
                "KeySchema": [
                    {"AttributeName": "thread_id", "KeyType": "HASH"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    )


def create_chat_sessions_table(client: "boto3.client") -> None:  # type: ignore[name-defined]
    """``prism-sessions``: ChatSession documents.

    PK: ``session_id`` (String)
    GSI: ``user_id-index`` – query sessions by user.
    """
    _create_table(
        client,
        TableName=settings.DYNAMODB_TABLE_SESSIONS,
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[
            {"AttributeName": "session_id", "AttributeType": "S"},
            {"AttributeName": "user_id", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "session_id", "KeyType": "HASH"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "user_id-index",
                "KeySchema": [
                    {"AttributeName": "user_id", "KeyType": "HASH"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    )


def main() -> None:
    endpoint = settings.DYNAMODB_ENDPOINT_URL or "AWS (no local endpoint)"
    print(f"Connecting to DynamoDB at: {endpoint}")
    client = _client()

    create_forum_threads_table(client)
    create_forum_posts_table(client)
    create_chat_sessions_table(client)

    print("Done.")


if __name__ == "__main__":
    main()
