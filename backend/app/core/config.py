from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # AWS
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/prism"

    # DynamoDB
    DYNAMODB_TABLE_FORUM: str = "prism-forum"
    DYNAMODB_TABLE_SESSIONS: str = "prism-sessions"

    # Bedrock model IDs
    BEDROCK_MODEL_COMPLEX: str = "claude-opus-4-6"
    BEDROCK_MODEL_FAST: str = "claude-haiku-4-5-20251001"

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # App
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"


settings = Settings()
