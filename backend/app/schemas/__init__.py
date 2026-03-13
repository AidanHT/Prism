"""Pydantic v2 schema package.

Import from the specific sub-modules for precise control, or use the
re-exports below as a convenience API.

Note: ``messages.MessageResponse`` refers to the *Message ORM model* response.
      ``base.OkResponse`` is the generic ``{message: str}`` success envelope.
"""
from app.schemas.assignments import (
    AssignmentCreate,
    AssignmentResponse,
    AssignmentUpdate,
    SubmissionCreate,
    SubmissionResponse,
    SubmissionUpdate,
)
from app.schemas.base import AppBaseModel, ErrorDetail, OkResponse
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventResponse,
    CalendarEventUpdate,
)
from app.schemas.content import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
    CourseFileCreate,
    CourseFileResponse,
    CourseFileUpdate,
    PageCreate,
    PageResponse,
    PageUpdate,
)
from app.schemas.courses import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentResponse,
    EnrollmentUpdate,
    ModuleCreate,
    ModuleItemCreate,
    ModuleItemResponse,
    ModuleItemUpdate,
    ModuleResponse,
    ModuleUpdate,
)
from app.schemas.discussions import (
    DiscussionCreate,
    DiscussionReplyCreate,
    DiscussionReplyResponse,
    DiscussionReplyUpdate,
    DiscussionResponse,
    DiscussionUpdate,
)
from app.schemas.dynamo import ChatMessage, ChatSession, ForumPost, ForumThread
from app.schemas.grades import GradeCreate, GradeResponse, GradeUpdate
from app.schemas.messages import (
    MessageCreate,
    MessageRecipientCreate,
    MessageRecipientResponse,
    MessageRecipientUpdate,
    MessageResponse,
    MessageUpdate,
)
from app.schemas.notifications import (
    NotificationCreate,
    NotificationResponse,
    NotificationUpdate,
)
from app.schemas.quizzes import (
    QuizAttemptCreate,
    QuizAttemptResponse,
    QuizAttemptUpdate,
    QuizCreate,
    QuizQuestionCreate,
    QuizQuestionResponse,
    QuizQuestionUpdate,
    QuizResponse,
    QuizUpdate,
)
from app.schemas.rubrics import (
    RatingItem,
    RubricCreate,
    RubricCriterionCreate,
    RubricCriterionResponse,
    RubricCriterionUpdate,
    RubricResponse,
    RubricUpdate,
)
from app.schemas.users import UserCreate, UserResponse, UserUpdate

__all__ = [
    # base
    "AppBaseModel",
    "OkResponse",
    "ErrorDetail",
    # users
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    # courses
    "CourseCreate",
    "CourseUpdate",
    "CourseResponse",
    "EnrollmentCreate",
    "EnrollmentUpdate",
    "EnrollmentResponse",
    "ModuleCreate",
    "ModuleUpdate",
    "ModuleResponse",
    "ModuleItemCreate",
    "ModuleItemUpdate",
    "ModuleItemResponse",
    # assignments
    "AssignmentCreate",
    "AssignmentUpdate",
    "AssignmentResponse",
    "SubmissionCreate",
    "SubmissionUpdate",
    "SubmissionResponse",
    # quizzes
    "QuizCreate",
    "QuizUpdate",
    "QuizResponse",
    "QuizQuestionCreate",
    "QuizQuestionUpdate",
    "QuizQuestionResponse",
    "QuizAttemptCreate",
    "QuizAttemptUpdate",
    "QuizAttemptResponse",
    # grades
    "GradeCreate",
    "GradeUpdate",
    "GradeResponse",
    # discussions
    "DiscussionCreate",
    "DiscussionUpdate",
    "DiscussionResponse",
    "DiscussionReplyCreate",
    "DiscussionReplyUpdate",
    "DiscussionReplyResponse",
    # content
    "AnnouncementCreate",
    "AnnouncementUpdate",
    "AnnouncementResponse",
    "PageCreate",
    "PageUpdate",
    "PageResponse",
    "CourseFileCreate",
    "CourseFileUpdate",
    "CourseFileResponse",
    # rubrics
    "RatingItem",
    "RubricCreate",
    "RubricUpdate",
    "RubricResponse",
    "RubricCriterionCreate",
    "RubricCriterionUpdate",
    "RubricCriterionResponse",
    # messages
    "MessageCreate",
    "MessageUpdate",
    "MessageResponse",
    "MessageRecipientCreate",
    "MessageRecipientUpdate",
    "MessageRecipientResponse",
    # notifications
    "NotificationCreate",
    "NotificationUpdate",
    "NotificationResponse",
    # calendar
    "CalendarEventCreate",
    "CalendarEventUpdate",
    "CalendarEventResponse",
    # dynamo
    "ForumThread",
    "ForumPost",
    "ChatSession",
    "ChatMessage",
]
