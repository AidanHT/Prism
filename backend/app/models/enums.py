"""SQLAlchemy-compatible enumerations shared across all ORM models."""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    student = "student"
    ta = "ta"
    professor = "professor"
    admin = "admin"


class EnrollmentRole(str, enum.Enum):
    student = "student"
    ta = "ta"
    professor = "professor"


class ModuleItemType(str, enum.Enum):
    assignment = "assignment"
    quiz = "quiz"
    page = "page"
    file = "file"
    external_url = "external_url"


class SubmissionType(str, enum.Enum):
    text = "text"
    file = "file"
    url = "url"


class QuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    true_false = "true_false"
    short_answer = "short_answer"
    essay = "essay"
    matching = "matching"


class EventType(str, enum.Enum):
    assignment_due = "assignment_due"
    quiz_due = "quiz_due"
    course_event = "course_event"
    personal = "personal"


class NotificationType(str, enum.Enum):
    grade_published = "grade_published"
    announcement = "announcement"
    message = "message"
    deadline_reminder = "deadline_reminder"
    submission_received = "submission_received"
