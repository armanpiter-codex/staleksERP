"""Feedback — бизнес-логика: CRUD, файлы, AI-обработка."""
import logging
import uuid
from typing import Sequence

from fastapi import UploadFile
from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.feedback.ai import categorize_feedback, transcribe_audio
from app.feedback.file_storage import (
    ALLOWED_AUDIO_TYPES,
    ALLOWED_IMAGE_TYPES,
    get_absolute_path,
    save_upload,
)
from app.feedback.models import (
    Feedback,
    FeedbackAttachment,
    FeedbackCategory,
    FeedbackFileType,
    FeedbackPriority,
    FeedbackStatus,
)
from app.feedback.schemas import FeedbackUpdateSchema

logger = logging.getLogger("staleks_erp.feedback")


def _file_type_from_mime(mime: str) -> FeedbackFileType:
    if mime in ALLOWED_IMAGE_TYPES:
        return FeedbackFileType.image
    if mime in ALLOWED_AUDIO_TYPES:
        return FeedbackFileType.audio
    return FeedbackFileType.document


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

async def create_feedback(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    content: str | None,
    category: FeedbackCategory,
    page_url: str | None,
    audio: UploadFile | None,
    attachments: list[UploadFile],
) -> Feedback:
    """Создать фидбэк: сохранить файлы, транскрибировать, AI-обработать."""
    feedback_id = uuid.uuid4()

    # --- Аудио ---
    voice_transcript: str | None = None
    audio_rel_path: str | None = None
    audio_size: int = 0

    if audio and audio.filename:
        audio_rel_path, audio_size = await save_upload(audio, feedback_id)
        abs_path = get_absolute_path(audio_rel_path)
        voice_transcript = await transcribe_audio(abs_path)

    # Если контент пуст, но есть транскрипция — используем её
    final_content = content or voice_transcript or ""
    if not final_content.strip():
        final_content = "(голосовое сообщение без транскрипции)"

    # --- AI-обработка ---
    ai_summary: str | None = None
    ai_category: FeedbackCategory | None = None
    priority: FeedbackPriority | None = None

    ai_result = await categorize_feedback(final_content, category.value)
    if ai_result:
        ai_summary = ai_result.get("summary")
        try:
            ai_category = FeedbackCategory(ai_result["category"])
        except (KeyError, ValueError):
            pass
        try:
            priority = FeedbackPriority(ai_result["priority"])
        except (KeyError, ValueError):
            pass

    # --- Запись в БД ---
    fb = Feedback(
        id=feedback_id,
        user_id=user_id,
        content=final_content,
        category=category,
        priority=priority,
        page_url=page_url,
        voice_transcript=voice_transcript,
        ai_summary=ai_summary,
        ai_category=ai_category,
        status=FeedbackStatus.new,
    )
    db.add(fb)

    # Аудио-вложение
    if audio_rel_path:
        db.add(FeedbackAttachment(
            feedback_id=feedback_id,
            file_name=audio.filename or "audio.webm",
            file_path=audio_rel_path,
            file_type=FeedbackFileType.audio,
            mime_type=audio.content_type or "audio/webm",
            file_size=audio_size,
        ))

    # Картинки
    for att_file in attachments:
        if not att_file.filename:
            continue
        rel_path, size = await save_upload(att_file, feedback_id)
        db.add(FeedbackAttachment(
            feedback_id=feedback_id,
            file_name=att_file.filename,
            file_path=rel_path,
            file_type=_file_type_from_mime(att_file.content_type or ""),
            mime_type=att_file.content_type or "application/octet-stream",
            file_size=size,
        ))

    await db.flush()
    await db.refresh(fb)
    return fb


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

async def list_feedback(
    db: AsyncSession,
    *,
    status: FeedbackStatus | None = None,
    category: FeedbackCategory | None = None,
    priority: FeedbackPriority | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[Sequence[Feedback], int]:
    """Список + total count."""
    q = select(Feedback).order_by(Feedback.created_at.desc())
    count_q = select(sa_func.count()).select_from(Feedback)

    if status is not None:
        q = q.where(Feedback.status == status)
        count_q = count_q.where(Feedback.status == status)
    if category is not None:
        q = q.where(Feedback.category == category)
        count_q = count_q.where(Feedback.category == category)
    if priority is not None:
        q = q.where(Feedback.priority == priority)
        count_q = count_q.where(Feedback.priority == priority)

    total = (await db.execute(count_q)).scalar_one()
    items = (await db.execute(q.limit(limit).offset(offset))).scalars().all()
    return items, total


async def count_new(db: AsyncSession) -> int:
    """Кол-во непрочитанных обращений."""
    q = select(sa_func.count()).select_from(Feedback).where(
        Feedback.status == FeedbackStatus.new
    )
    return (await db.execute(q)).scalar_one()


async def get_feedback(db: AsyncSession, feedback_id: uuid.UUID) -> Feedback:
    result = await db.execute(select(Feedback).where(Feedback.id == feedback_id))
    fb = result.scalar_one_or_none()
    if fb is None:
        raise NotFoundException("Feedback not found")
    return fb


async def get_attachment(db: AsyncSession, attachment_id: uuid.UUID) -> FeedbackAttachment:
    result = await db.execute(
        select(FeedbackAttachment).where(FeedbackAttachment.id == attachment_id)
    )
    att = result.scalar_one_or_none()
    if att is None:
        raise NotFoundException("Attachment not found")
    return att


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

async def update_feedback(
    db: AsyncSession,
    feedback_id: uuid.UUID,
    data: FeedbackUpdateSchema,
) -> Feedback:
    fb = await get_feedback(db, feedback_id)
    if data.status is not None:
        fb.status = data.status
    if data.admin_notes is not None:
        fb.admin_notes = data.admin_notes
    await db.flush()
    await db.refresh(fb)
    return fb
