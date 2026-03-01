from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://staleks:password@localhost:5432/staleks_erp"

    # Redis
    REDIS_URL: str = "redis://:password@localhost:6379/0"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # App
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # CORS — allowed frontend origins
    # In .env: ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def allowed_origins(self) -> list[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    # Telegram (Phase 2)
    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_WEBHOOK_URL: str | None = None

    # Bitrix24 (Phase 2)
    BITRIX24_WEBHOOK_URL: str | None = None
    BITRIX24_API_KEY: str | None = None

    # OpenAI (optional — for feedback AI processing)
    OPENAI_API_KEY: str | None = None

    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_FEEDBACK_AUDIO_SIZE: int = 10 * 1024 * 1024   # 10 MB
    MAX_FEEDBACK_IMAGE_SIZE: int = 5 * 1024 * 1024    # 5 MB
    MAX_FEEDBACK_ATTACHMENTS: int = 5

    # S3 (Phase 2)
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_BUCKET_NAME: str = "staleks-erp"

    model_config = {"env_file": ".env", "case_sensitive": True, "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
