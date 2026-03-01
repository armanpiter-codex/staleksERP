"""Feedback — модели для хранения обратной связи пользователей."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FeedbackCategory(str, enum.Enum):
    bug = "bug"                # Ошибка / баг
    suggestion = "suggestion"  # Предложение по улучшению
    question = "question"      # Вопрос
    other = "other"            # Другое


class FeedbackPriority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class FeedbackStatus(str, enum.Enum):
    new = "new"                # Новый (не прочитан)
    reviewing = "reviewing"    # На рассмотрении
    resolved = "resolved"      # Решён
    closed = "closed"          # Закрыт


class FeedbackFileType(str, enum.Enum):
    image = "image"
    audio = "audio"
    document = "document"


class Feedback(Base):
    """Обратная связь от пользователя ERP."""
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Содержимое
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[FeedbackCategory] = mapped_column(
        Enum(FeedbackCategory, name="feedback_category_enum", create_type=False),
        nullable=False,
        default=FeedbackCategory.other,
    )
    priority: Mapped[FeedbackPriority | None] = mapped_column(
        Enum(FeedbackPriority, name="feedback_priority_enum", create_type=False),
        nullable=True,
    )
    page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Голосовое сообщение (транскрипция Whisper, хранится отдельно от content)
    voice_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)

    # AI-обработка (опционально)
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_category: Mapped[FeedbackCategory | None] = mapped_column(
        Enum(FeedbackCategory, name="feedback_category_enum", create_type=False),
        nullable=True,
    )

    # Статус и заметки
    status: Mapped[FeedbackStatus] = mapped_column(
        Enum(FeedbackStatus, name="feedback_status_enum", create_type=False),
        nullable=False,
        default=FeedbackStatus.new,
        index=True,
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user = relationship("User", lazy="selectin", foreign_keys=[user_id])
    attachments: Mapped[list["FeedbackAttachment"]] = relationship(
        "FeedbackAttachment",
        back_populates="feedback",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class FeedbackAttachment(Base):
    """Вложение к обратной связи (фото, аудио, документ)."""
    __tablename__ = "feedback_attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    feedback_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("feedback.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[FeedbackFileType] = mapped_column(
        Enum(FeedbackFileType, name="feedback_file_type_enum", create_type=False),
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    feedback: Mapped["Feedback"] = relationship(
        "Feedback", back_populates="attachments"
    )
