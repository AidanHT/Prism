from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # AWS
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_SESSION_TOKEN: str | None = None  # Required for temporary credentials (SSO, assume-role)

    # DynamoDB
    DYNAMODB_ENDPOINT_URL: str | None = None  # e.g. "http://localhost:8000" for DynamoDB Local

    # ── DynamoDB table names ──────────────────────────────────────────────────
    DYNAMODB_TABLE_USERS: str = "prism-users"
    DYNAMODB_TABLE_COURSES: str = "prism-courses"
    DYNAMODB_TABLE_ENROLLMENTS: str = "prism-enrollments"
    DYNAMODB_TABLE_ASSIGNMENTS: str = "prism-assignments"
    DYNAMODB_TABLE_SUBMISSIONS: str = "prism-submissions"
    DYNAMODB_TABLE_GRADES: str = "prism-grades"
    DYNAMODB_TABLE_QUIZZES: str = "prism-quizzes"
    DYNAMODB_TABLE_QUIZ_QUESTIONS: str = "prism-quiz-questions"
    DYNAMODB_TABLE_QUIZ_ATTEMPTS: str = "prism-quiz-attempts"
    DYNAMODB_TABLE_DISCUSSIONS: str = "prism-discussions"
    DYNAMODB_TABLE_DISCUSSION_REPLIES: str = "prism-discussion-replies"
    DYNAMODB_TABLE_ANNOUNCEMENTS: str = "prism-announcements"
    DYNAMODB_TABLE_MODULES: str = "prism-modules"
    DYNAMODB_TABLE_MODULE_ITEMS: str = "prism-module-items"
    DYNAMODB_TABLE_PAGES: str = "prism-pages"
    DYNAMODB_TABLE_COURSE_FILES: str = "prism-course-files"
    DYNAMODB_TABLE_RUBRICS: str = "prism-rubrics"
    DYNAMODB_TABLE_RUBRIC_CRITERIA: str = "prism-rubric-criteria"
    DYNAMODB_TABLE_CALENDAR_EVENTS: str = "prism-calendar-events"
    DYNAMODB_TABLE_MESSAGES: str = "prism-messages"
    DYNAMODB_TABLE_MESSAGE_RECIPIENTS: str = "prism-message-recipients"
    DYNAMODB_TABLE_NOTIFICATIONS: str = "prism-notifications"
    DYNAMODB_TABLE_FORUM: str = "prism-forum"
    DYNAMODB_TABLE_FORUM_POSTS: str = "prism-forum-posts"
    DYNAMODB_TABLE_SESSIONS: str = "prism-sessions"

    # Bedrock model IDs
    BEDROCK_MODEL_COMPLEX: str = "anthropic.claude-opus-4-6-v1:0"
    BEDROCK_MODEL_FAST: str = "anthropic.claude-haiku-4-5-20251001-v1:0"

    # Forum AI settings
    FORUM_SIMILARITY_THRESHOLD: float = 0.75

    # OpenSearch (Vector Engine)
    OPENSEARCH_HOST: str = "localhost"
    OPENSEARCH_PORT: int = 9200
    OPENSEARCH_USERNAME: str = "admin"
    OPENSEARCH_PASSWORD: str = "admin"
    OPENSEARCH_USE_SSL: bool = False
    OPENSEARCH_FORUM_INDEX: str = "prism-forum-embeddings"
    # Set to True for OpenSearch Serverless (uses IAM SigV4 auth instead of basic auth)
    OPENSEARCH_SERVERLESS: bool = False

    # S3
    S3_FILES_BUCKET: str = "prism-files"

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # App
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"


settings = Settings()
