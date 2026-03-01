"""Feedback — Pydantic схемы."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.feedback.models import (
    FeedbackCategory,
    FeedbackFileType,
    FeedbackPriority,
    FeedbackStatus,
)


class FeedbackAuthorSchema(BaseModel):
    id: uuid.UUID
    username: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)


class FeedbackAttachmentSchema(BaseModel):
    id: uuid.UUID
    file_name: str
    file_path: str
    file_type: FeedbackFileType
    mime_type: str
    file_size: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeedbackSchema(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user: FeedbackAuthorSchema | None
    content: str
    category: FeedbackCategory
    priority: FeedbackPriority | None
    status: FeedbackStatus
    page_url: str | None
    voice_transcript: str | None
    ai_summary: str | None
    ai_category: FeedbackCategory | None
    admin_notes: str | None
    attachments: list[FeedbackAttachmentSchema] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedFeedbackSchema(BaseModel):
    items: list[FeedbackSchema]
    total: int


class FeedbackUpdateSchema(BaseModel):
    status: FeedbackStatus | None = None
    admin_notes: str | None = Field(None, max_length=1000)
