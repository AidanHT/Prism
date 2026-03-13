"""Model package – imports every ORM model so they register with Base.metadata.

Alembic's env.py imports this module to ensure autogenerate sees all tables.
"""
from app.models.assignment import Assignment, Submission  # noqa: F401
from app.models.calendar import CalendarEvent  # noqa: F401
from app.models.content import Announcement, CourseFile, Page  # noqa: F401
from app.models.course import Course, Enrollment, Module, ModuleItem  # noqa: F401
from app.models.discussion import Discussion, DiscussionReply  # noqa: F401
from app.models.grade import Grade  # noqa: F401
from app.models.message import Message, MessageRecipient  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion  # noqa: F401
from app.models.rubric import Rubric, RubricCriterion  # noqa: F401
from app.models.user import User  # noqa: F401

__all__ = [
    "User",
    "Course",
    "Enrollment",
    "Module",
    "ModuleItem",
    "Assignment",
    "Submission",
    "Quiz",
    "QuizQuestion",
    "QuizAttempt",
    "Discussion",
    "DiscussionReply",
    "Announcement",
    "Page",
    "CourseFile",
    "Rubric",
    "RubricCriterion",
    "Grade",
    "CalendarEvent",
    "Message",
    "MessageRecipient",
    "Notification",
]
