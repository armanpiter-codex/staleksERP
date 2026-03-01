"""Feedback — бизнес-логика: CRUD, файлы, AI-диалог, финализация."""
import logging
import uuid
from typing import Sequence

from fastapi import UploadFile
from sqlalchemy import func as sa_func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import BadRequestException, NotFoundException
from app.feedback.ai import (
    MAX_DIALOG_TURNS,
    categorize_feedback,
    clarify_feedback,
    finalize_feedback as ai_finalize,
    generate_next_message,
    transcribe_audio,
)
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
    FeedbackMessage,
    FeedbackPriority,
    FeedbackStatus,
    MessageRole,
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
    page_url: str | None,
    audio: UploadFile | None,
    attachments: list[UploadFile],
) -> Feedback:
    """
    Создать фидбэк: сохранить файлы, транскрибировать, запустить AI-диалог.
    Статус сразу = clarifying, первый вопрос AI добавляется в messages.
    """
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

    # --- Запись в БД ---
    fb = Feedback(
        id=feedback_id,
        user_id=user_id,
        content=final_content,
        category=FeedbackCategory.other,   # AI определит точную категорию при финализации
        page_url=page_url,
        voice_transcript=voice_transcript,
        status=FeedbackStatus.clarifying,
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

    # --- AI: первый уточняющий вопрос ---
    first_question = await clarify_feedback(final_content, voice_transcript)
    if not first_question:
        first_question = (
            "Спасибо за обратную связь! Можете уточнить детали или "
            "нажать «Подтвердить и отправить»."
        )

    db.add(FeedbackMessage(
        feedback_id=feedback_id,
        role=MessageRole.assistant,
        content=first_question,
    ))
    await db.flush()
    await db.refresh(fb)
    return fb


# ---------------------------------------------------------------------------
# Dialog
# ---------------------------------------------------------------------------

async def get_messages(
    db: AsyncSession,
    feedback_id: uuid.UUID,
) -> list[FeedbackMessage]:
    """Получить все сообщения диалога в хронологическом порядке."""
    result = await db.execute(
        select(FeedbackMessage)
        .where(FeedbackMessage.feedback_id == feedback_id)
        .order_by(FeedbackMessage.created_at)
    )
    return list(result.scalars().all())


async def _add_message(
    db: AsyncSession,
    feedback_id: uuid.UUID,
    role: MessageRole,
    content: str,
) -> FeedbackMessage:
    msg = FeedbackMessage(feedback_id=feedback_id, role=role, content=content)
    db.add(msg)
    await db.flush()
    return msg


async def process_user_reply(
    db: AsyncSession,
    fb: Feedback,
    user_content: str,
) -> tuple[Feedback, FeedbackMessage | None]:
    """
    Обработать ответ пользователя в диалоге.
    Возвращает (feedback, ai_message | None).
    Если turns >= MAX_DIALOG_TURNS — автоматически финализирует.
    """
    if fb.status != FeedbackStatus.clarifying:
        raise BadRequestException("Фидбэк не в стадии уточнения")

    # Добавляем сообщение пользователя
    await _add_message(db, fb.id, MessageRole.user, user_content)
    fb.dialog_turns += 1
    await db.flush()

    # Авто-финализация при достижении лимита
    if fb.dialog_turns >= MAX_DIALOG_TURNS:
        await _do_finalize(db, fb)
        return fb, None

    # Генерируем следующий вопрос AI
    messages = await get_messages(db, fb.id)
    history = [{"role": m.role.value, "content": m.content} for m in messages]
    is_last = fb.dialog_turns == MAX_DIALOG_TURNS - 1

    ai_response = await generate_next_message(fb.content, history, is_last_turn=is_last)
    if not ai_response:
        ai_response = "Понял. Нажмите «Подтвердить и отправить» когда будете готовы."

    ai_msg = await _add_message(db, fb.id, MessageRole.assistant, ai_response)
    return fb, ai_msg


async def confirm_feedback(db: AsyncSession, fb: Feedback) -> Feedback:
    """
    Пользователь подтвердил фидбэк — финализировать и отправить в Telegram.
    """
    if fb.status not in (FeedbackStatus.clarifying, FeedbackStatus.new):
        raise BadRequestException("Фидбэк нельзя подтвердить в этом статусе")

    await _do_finalize(db, fb)
    return fb


async def _do_finalize(db: AsyncSession, fb: Feedback) -> None:
    """
    Внутренняя финализация:
    - Генерация AI-инструкции для разработчика
    - Обновление category/priority/summary
    - Смена статуса на confirmed
    Внешний бот (Telegram) сам заберёт confirmed фидбэки по крону.
    """
    messages = await get_messages(db, fb.id)
    history = [{"role": m.role.value, "content": m.content} for m in messages]

    result = await ai_finalize(fb.content, history, fb.page_url)

    if result:
        fb.final_instruction = result.get("instruction") or fb.content
        fb.ai_summary = result.get("summary") or fb.ai_summary
        try:
            fb.ai_category = FeedbackCategory(result["category"])
            fb.category = fb.ai_category
        except (KeyError, ValueError):
            pass
        try:
            fb.priority = FeedbackPriority(result["priority"])
        except (KeyError, ValueError):
            fb.priority = FeedbackPriority.medium
    else:
        # AI недоступен — используем исходный контент
        fb.final_instruction = fb.ai_summary or fb.content
        if not fb.priority:
            fb.priority = FeedbackPriority.medium

    fb.status = FeedbackStatus.confirmed
    await db.flush()


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
    """Кол-во обращений требующих внимания администратора (new + confirmed)."""
    q = select(sa_func.count()).select_from(Feedback).where(
        Feedback.status.in_([FeedbackStatus.new, FeedbackStatus.confirmed])
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
