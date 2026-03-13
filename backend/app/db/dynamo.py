"""DynamoDB resource manager with async-compatible wrapper methods.

Boto3 is synchronous; all blocking calls are offloaded to a thread-pool
executor via ``asyncio.get_running_loop().run_in_executor`` so they do not
stall the FastAPI event loop.

All Prism tables use ``id`` as the partition key unless noted otherwise.
GSIs follow the naming convention ``{attribute}-index``.
"""
from __future__ import annotations

import asyncio
from functools import partial
from typing import TYPE_CHECKING, Any

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from app.core.config import settings

if TYPE_CHECKING:
    from mypy_boto3_dynamodb.service_resource import DynamoDBServiceResource, Table


class DynamoDBManager:
    """Singleton-style manager that lazily initialises the Boto3 DynamoDB
    resource and exposes async-compatible CRUD helpers for all Prism tables.
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
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, partial(fn, *args, **kwargs))

    # ── Generic CRUD ─────────────────────────────────────────────────────────

    async def put_item(self, table_name: str, item: dict[str, Any]) -> dict[str, Any]:
        table = self._table(table_name)
        return await self._run_sync(table.put_item, Item=item)

    async def get_item(self, table_name: str, key: dict[str, Any]) -> dict[str, Any] | None:
        table = self._table(table_name)
        response = await self._run_sync(table.get_item, Key=key)
        return response.get("Item")  # type: ignore[return-value]

    async def delete_item(self, table_name: str, key: dict[str, Any]) -> dict[str, Any]:
        table = self._table(table_name)
        return await self._run_sync(table.delete_item, Key=key)

    async def update_item(
        self, table_name: str, key: dict[str, Any], updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Set multiple attributes on an existing item. Returns the updated item."""
        if not updates:
            return await self.get_item(table_name, key)
        expr_parts: list[str] = []
        names: dict[str, str] = {}
        values: dict[str, Any] = {}
        for i, (k, v) in enumerate(updates.items()):
            alias = f"#a{i}"
            val_alias = f":v{i}"
            expr_parts.append(f"{alias} = {val_alias}")
            names[alias] = k
            values[val_alias] = v
        table = self._table(table_name)
        resp = await self._run_sync(
            table.update_item,
            Key=key,
            UpdateExpression="SET " + ", ".join(expr_parts),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
        return resp.get("Attributes")  # type: ignore[return-value]

    async def query(self, table_name: str, **kwargs: Any) -> list[dict[str, Any]]:
        table = self._table(table_name)
        response = await self._run_sync(table.query, **kwargs)
        return response.get("Items", [])  # type: ignore[return-value]

    async def scan(self, table_name: str, **kwargs: Any) -> list[dict[str, Any]]:
        """Full table scan. Use sparingly — prefer query with an index."""
        table = self._table(table_name)
        response = await self._run_sync(table.scan, **kwargs)
        return response.get("Items", [])  # type: ignore[return-value]

    async def batch_get(
        self, table_name: str, keys: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """BatchGetItem for up to 100 keys at a time."""
        if not keys:
            return []
        resource = self._get_resource()
        results: list[dict[str, Any]] = []
        # DynamoDB batch_get_item limit is 100
        for i in range(0, len(keys), 100):
            chunk = keys[i : i + 100]
            resp = await self._run_sync(
                resource.batch_get_item,
                RequestItems={table_name: {"Keys": chunk}},
            )
            results.extend(resp.get("Responses", {}).get(table_name, []))
        return results

    async def query_index(
        self, table_name: str, index_name: str, pk_attr: str, pk_value: str
    ) -> list[dict[str, Any]]:
        """Shorthand: query a GSI by its partition key."""
        return await self.query(
            table_name,
            IndexName=index_name,
            KeyConditionExpression=Key(pk_attr).eq(pk_value),
        )

    # ── Users ────────────────────────────────────────────────────────────────

    async def put_user(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_USERS, item)

    async def get_user(self, user_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_USERS, {"id": user_id})

    async def query_user_by_email(self, email: str) -> dict[str, Any] | None:
        items = await self.query_index(
            settings.DYNAMODB_TABLE_USERS, "email-index", "email", email
        )
        return items[0] if items else None

    async def search_users(self, prefix: str, limit: int = 10) -> list[dict[str, Any]]:
        """Scan users whose name or email starts with *prefix* (case-insensitive)."""
        low = prefix.lower()
        items = await self.scan(settings.DYNAMODB_TABLE_USERS)
        matched = [
            u for u in items
            if u.get("name", "").lower().startswith(low)
            or u.get("email", "").lower().startswith(low)
        ]
        return matched[:limit]

    async def update_user(self, user_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_USERS, {"id": user_id}, updates)

    # ── Courses ──────────────────────────────────────────────────────────────

    async def put_course(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_COURSES, item)

    async def get_course(self, course_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_COURSES, {"id": course_id})

    async def update_course(self, course_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_COURSES, {"id": course_id}, updates)

    # ── Enrollments ──────────────────────────────────────────────────────────

    async def put_enrollment(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_ENROLLMENTS, item)

    async def get_enrollment(self, enrollment_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_ENROLLMENTS, {"id": enrollment_id})

    async def query_enrollments_by_user(self, user_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_ENROLLMENTS, "user_id-index", "user_id", user_id
        )

    async def query_enrollments_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_ENROLLMENTS, "course_id-index", "course_id", course_id
        )

    async def update_enrollment(self, enrollment_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_ENROLLMENTS, {"id": enrollment_id}, updates)

    # ── Assignments ──────────────────────────────────────────────────────────

    async def put_assignment(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_ASSIGNMENTS, item)

    async def get_assignment(self, assignment_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_ASSIGNMENTS, {"id": assignment_id})

    async def query_assignments_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_ASSIGNMENTS, "course_id-index", "course_id", course_id
        )

    async def update_assignment(self, assignment_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_ASSIGNMENTS, {"id": assignment_id}, updates)

    async def delete_assignment(self, assignment_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_ASSIGNMENTS, {"id": assignment_id})

    # ── Submissions ──────────────────────────────────────────────────────────

    async def put_submission(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_SUBMISSIONS, item)

    async def get_submission(self, submission_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_SUBMISSIONS, {"id": submission_id})

    async def query_submissions_by_assignment(self, assignment_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_SUBMISSIONS, "assignment_id-index", "assignment_id", assignment_id
        )

    async def query_submissions_by_student(self, student_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_SUBMISSIONS, "student_id-index", "student_id", student_id
        )

    # ── Grades ───────────────────────────────────────────────────────────────

    async def put_grade(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_GRADES, item)

    async def get_grade(self, grade_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_GRADES, {"id": grade_id})

    async def query_grades_by_enrollment(self, enrollment_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_GRADES, "enrollment_id-index", "enrollment_id", enrollment_id
        )

    async def update_grade(self, grade_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_GRADES, {"id": grade_id}, updates)

    # ── Quizzes ──────────────────────────────────────────────────────────────

    async def put_quiz(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_QUIZZES, item)

    async def get_quiz(self, quiz_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_QUIZZES, {"id": quiz_id})

    async def query_quizzes_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_QUIZZES, "course_id-index", "course_id", course_id
        )

    async def update_quiz(self, quiz_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_QUIZZES, {"id": quiz_id}, updates)

    async def delete_quiz(self, quiz_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_QUIZZES, {"id": quiz_id})

    # ── Quiz Questions ───────────────────────────────────────────────────────

    async def put_quiz_question(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_QUIZ_QUESTIONS, item)

    async def get_quiz_question(self, question_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_QUIZ_QUESTIONS, {"id": question_id})

    async def query_questions_by_quiz(self, quiz_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_QUIZ_QUESTIONS, "quiz_id-index", "quiz_id", quiz_id
        )

    async def update_quiz_question(self, question_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_QUIZ_QUESTIONS, {"id": question_id}, updates)

    async def delete_quiz_question(self, question_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_QUIZ_QUESTIONS, {"id": question_id})

    # ── Quiz Attempts ────────────────────────────────────────────────────────

    async def put_quiz_attempt(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_QUIZ_ATTEMPTS, item)

    async def get_quiz_attempt(self, attempt_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_QUIZ_ATTEMPTS, {"id": attempt_id})

    async def query_attempts_by_quiz(self, quiz_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_QUIZ_ATTEMPTS, "quiz_id-index", "quiz_id", quiz_id
        )

    async def query_attempts_by_student(self, student_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_QUIZ_ATTEMPTS, "student_id-index", "student_id", student_id
        )

    async def update_quiz_attempt(self, attempt_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_QUIZ_ATTEMPTS, {"id": attempt_id}, updates)

    # ── Discussions (SQL-based, not forum) ───────────────────────────────────

    async def put_discussion(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_DISCUSSIONS, item)

    async def get_discussion(self, discussion_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_DISCUSSIONS, {"id": discussion_id})

    async def query_discussions_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_DISCUSSIONS, "course_id-index", "course_id", course_id
        )

    async def update_discussion(self, discussion_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_DISCUSSIONS, {"id": discussion_id}, updates)

    async def delete_discussion(self, discussion_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_DISCUSSIONS, {"id": discussion_id})

    # ── Discussion Replies ───────────────────────────────────────────────────

    async def put_discussion_reply(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_DISCUSSION_REPLIES, item)

    async def get_discussion_reply(self, reply_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_DISCUSSION_REPLIES, {"id": reply_id})

    async def query_replies_by_discussion(self, discussion_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_DISCUSSION_REPLIES, "discussion_id-index", "discussion_id", discussion_id
        )

    async def update_discussion_reply(self, reply_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_DISCUSSION_REPLIES, {"id": reply_id}, updates)

    async def delete_discussion_reply(self, reply_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_DISCUSSION_REPLIES, {"id": reply_id})

    # ── Announcements ────────────────────────────────────────────────────────

    async def put_announcement(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_ANNOUNCEMENTS, item)

    async def get_announcement(self, announcement_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_ANNOUNCEMENTS, {"id": announcement_id})

    async def query_announcements_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_ANNOUNCEMENTS, "course_id-index", "course_id", course_id
        )

    async def update_announcement(self, announcement_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_ANNOUNCEMENTS, {"id": announcement_id}, updates)

    async def delete_announcement(self, announcement_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_ANNOUNCEMENTS, {"id": announcement_id})

    # ── Modules ──────────────────────────────────────────────────────────────

    async def put_module(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_MODULES, item)

    async def get_module(self, module_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_MODULES, {"id": module_id})

    async def query_modules_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_MODULES, "course_id-index", "course_id", course_id
        )

    async def update_module(self, module_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_MODULES, {"id": module_id}, updates)

    async def delete_module(self, module_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_MODULES, {"id": module_id})

    # ── Module Items ─────────────────────────────────────────────────────────

    async def put_module_item(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_MODULE_ITEMS, item)

    async def get_module_item(self, item_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_MODULE_ITEMS, {"id": item_id})

    async def query_items_by_module(self, module_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_MODULE_ITEMS, "module_id-index", "module_id", module_id
        )

    async def update_module_item(self, item_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_MODULE_ITEMS, {"id": item_id}, updates)

    async def delete_module_item(self, item_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_MODULE_ITEMS, {"id": item_id})

    # ── Pages ────────────────────────────────────────────────────────────────

    async def put_page(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_PAGES, item)

    async def get_page(self, page_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_PAGES, {"id": page_id})

    async def query_pages_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_PAGES, "course_id-index", "course_id", course_id
        )

    # ── Course Files ─────────────────────────────────────────────────────────

    async def put_course_file(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_COURSE_FILES, item)

    async def query_files_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_COURSE_FILES, "course_id-index", "course_id", course_id
        )

    # ── Rubrics ──────────────────────────────────────────────────────────────

    async def put_rubric(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_RUBRICS, item)

    async def get_rubric(self, rubric_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_RUBRICS, {"id": rubric_id})

    async def query_rubrics_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_RUBRICS, "course_id-index", "course_id", course_id
        )

    # ── Rubric Criteria ──────────────────────────────────────────────────────

    async def put_rubric_criterion(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_RUBRIC_CRITERIA, item)

    async def query_criteria_by_rubric(self, rubric_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_RUBRIC_CRITERIA, "rubric_id-index", "rubric_id", rubric_id
        )

    # ── Calendar Events ──────────────────────────────────────────────────────

    async def put_calendar_event(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_CALENDAR_EVENTS, item)

    async def get_calendar_event(self, event_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_CALENDAR_EVENTS, {"id": event_id})

    async def query_events_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_CALENDAR_EVENTS, "course_id-index", "course_id", course_id
        )

    async def query_events_by_user(self, user_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_CALENDAR_EVENTS, "user_id-index", "user_id", user_id
        )

    async def update_calendar_event(self, event_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_CALENDAR_EVENTS, {"id": event_id}, updates)

    async def delete_calendar_event(self, event_id: str) -> dict[str, Any]:
        return await self.delete_item(settings.DYNAMODB_TABLE_CALENDAR_EVENTS, {"id": event_id})

    # ── Messages ─────────────────────────────────────────────────────────────

    async def put_message(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_MESSAGES, item)

    async def get_message(self, message_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_MESSAGES, {"id": message_id})

    async def query_messages_by_sender(self, sender_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_MESSAGES, "sender_id-index", "sender_id", sender_id
        )

    # ── Message Recipients ───────────────────────────────────────────────────

    async def put_message_recipient(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_MESSAGE_RECIPIENTS, item)

    async def query_recipients_by_message(self, message_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_MESSAGE_RECIPIENTS, "message_id-index", "message_id", message_id
        )

    async def query_recipients_by_user(self, recipient_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_MESSAGE_RECIPIENTS, "recipient_id-index", "recipient_id", recipient_id
        )

    async def update_message_recipient(self, recipient_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_MESSAGE_RECIPIENTS, {"id": recipient_id}, updates)

    # ── Notifications ────────────────────────────────────────────────────────

    async def put_notification(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_NOTIFICATIONS, item)

    async def get_notification(self, notification_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_NOTIFICATIONS, {"id": notification_id})

    async def query_notifications_by_user(self, user_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_NOTIFICATIONS, "user_id-index", "user_id", user_id
        )

    async def update_notification(self, notification_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        return await self.update_item(settings.DYNAMODB_TABLE_NOTIFICATIONS, {"id": notification_id}, updates)

    async def batch_mark_notifications_read(self, user_id: str) -> int:
        """Mark all unread notifications for *user_id* as read. Returns count updated."""
        items = await self.query_notifications_by_user(user_id)
        count = 0
        for item in items:
            if not item.get("is_read"):
                await self.update_notification(item["id"], {"is_read": True})
                count += 1
        return count

    # ── Forum (existing) ─────────────────────────────────────────────────────

    async def put_forum_thread(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_FORUM, item)

    async def get_forum_thread(self, thread_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_FORUM, {"id": thread_id})

    async def query_forum_threads_by_course(self, course_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_FORUM, "course_id-index", "course_id", course_id
        )

    async def put_forum_post(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_FORUM_POSTS, item)

    async def get_forum_post(self, post_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_FORUM_POSTS, {"id": post_id})

    async def query_forum_posts_by_thread(self, thread_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_FORUM_POSTS, "thread_id-index", "thread_id", thread_id
        )

    # ── Chat sessions (existing) ─────────────────────────────────────────────

    async def put_chat_session(self, item: dict[str, Any]) -> dict[str, Any]:
        return await self.put_item(settings.DYNAMODB_TABLE_SESSIONS, item)

    async def get_chat_session(self, session_id: str) -> dict[str, Any] | None:
        return await self.get_item(settings.DYNAMODB_TABLE_SESSIONS, {"session_id": session_id})

    async def query_chat_sessions_by_user(self, user_id: str) -> list[dict[str, Any]]:
        return await self.query_index(
            settings.DYNAMODB_TABLE_SESSIONS, "user_id-index", "user_id", user_id
        )

    # ── Table provisioning (for local development / DynamoDB Local) ──────────

    async def ensure_tables(self) -> None:
        """Create all Prism DynamoDB tables if they don't already exist.

        Intended for local development with DynamoDB Local only.
        """
        resource = self._get_resource()
        existing: set[str] = set()
        try:
            existing = {t.name for t in await self._run_sync(lambda: list(resource.tables.all()))}
        except Exception:
            pass

        table_defs: list[dict[str, Any]] = [
            # (table_name, pk_attr, gsi_attrs)
            self._table_def(settings.DYNAMODB_TABLE_USERS, "id", ["email"]),
            self._table_def(settings.DYNAMODB_TABLE_COURSES, "id", ["instructor_id"]),
            self._table_def(settings.DYNAMODB_TABLE_ENROLLMENTS, "id", ["user_id", "course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_ASSIGNMENTS, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_SUBMISSIONS, "id", ["assignment_id", "student_id"]),
            self._table_def(settings.DYNAMODB_TABLE_GRADES, "id", ["enrollment_id"]),
            self._table_def(settings.DYNAMODB_TABLE_QUIZZES, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_QUIZ_QUESTIONS, "id", ["quiz_id"]),
            self._table_def(settings.DYNAMODB_TABLE_QUIZ_ATTEMPTS, "id", ["quiz_id", "student_id"]),
            self._table_def(settings.DYNAMODB_TABLE_DISCUSSIONS, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_DISCUSSION_REPLIES, "id", ["discussion_id"]),
            self._table_def(settings.DYNAMODB_TABLE_ANNOUNCEMENTS, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_MODULES, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_MODULE_ITEMS, "id", ["module_id"]),
            self._table_def(settings.DYNAMODB_TABLE_PAGES, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_COURSE_FILES, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_RUBRICS, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_RUBRIC_CRITERIA, "id", ["rubric_id"]),
            self._table_def(settings.DYNAMODB_TABLE_CALENDAR_EVENTS, "id", ["course_id", "user_id"]),
            self._table_def(settings.DYNAMODB_TABLE_MESSAGES, "id", ["sender_id"]),
            self._table_def(settings.DYNAMODB_TABLE_MESSAGE_RECIPIENTS, "id", ["message_id", "recipient_id"]),
            self._table_def(settings.DYNAMODB_TABLE_NOTIFICATIONS, "id", ["user_id"]),
            self._table_def(settings.DYNAMODB_TABLE_FORUM, "id", ["course_id"]),
            self._table_def(settings.DYNAMODB_TABLE_FORUM_POSTS, "id", ["thread_id"]),
            self._table_def(settings.DYNAMODB_TABLE_SESSIONS, "session_id", ["user_id"]),
        ]

        for td in table_defs:
            name = td["TableName"]
            if name in existing:
                continue
            try:
                await self._run_sync(resource.create_table, **td)
                # Wait until active
                table = self._table(name)
                await self._run_sync(table.meta.client.get_waiter("table_exists").wait, TableName=name)
            except ClientError as e:
                if e.response["Error"]["Code"] != "ResourceInUseException":
                    raise

    @staticmethod
    def _table_def(table_name: str, pk: str, gsi_attrs: list[str]) -> dict[str, Any]:
        """Build a CreateTable kwargs dict with PAY_PER_REQUEST billing."""
        attrs = [{
            "AttributeName": pk,
            "AttributeType": "S",
        }]
        gsis = []
        for attr in gsi_attrs:
            attrs.append({"AttributeName": attr, "AttributeType": "S"})
            gsis.append({
                "IndexName": f"{attr}-index",
                "KeySchema": [{"AttributeName": attr, "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            })

        td: dict[str, Any] = {
            "TableName": table_name,
            "KeySchema": [{"AttributeName": pk, "KeyType": "HASH"}],
            "AttributeDefinitions": attrs,
            "BillingMode": "PAY_PER_REQUEST",
        }
        if gsis:
            td["GlobalSecondaryIndexes"] = gsis
        return td


# Module-level singleton used throughout the application.
dynamo_manager = DynamoDBManager()
