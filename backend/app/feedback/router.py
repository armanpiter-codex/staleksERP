"""Feedback — API endpoints для /feedback."""
import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.auth.schemas import TokenPayload
from app.common.exceptions import BadRequestException, ForbiddenException
from app.config import get_settings
from app.database import get_db
from app.feedback import service as svc
from app.feedback.file_storage import ALLOWED_AUDIO_TYPES, ALLOWED_IMAGE_TYPES, get_absolute_path
from app.feedback.models import FeedbackCategory, FeedbackPriority, FeedbackStatus
from app.feedback.schemas import (
    FeedbackDialogResponseSchema,
    FeedbackMessageSchema,
    FeedbackReplySchema,
    FeedbackSchema,
    FeedbackUpdateSchema,
    PaginatedFeedbackSchema,
)

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackSchema, status_code=201)
async def create_feedback(
    content: str | None = Form(None),
    page_url: str | None = Form(None),
    audio: UploadFile | None = File(None),
    attachments: list[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_permission("feedback:write")),
):
    """
    Отправить обратную связь (текст, голос, скриншоты).
    Категория определяется AI автоматически.
    Возвращает фидбэк с первым уточняющим вопросом AI в messages.
    """
    settings = get_settings()

    # Валидация: хотя бы текст или аудио
    has_content = content and content.strip() and len(content.strip()) >= 10
    has_audio = audio is not None and audio.filename
    if not has_content and not has_audio:
        raise BadRequestException("Укажите текст (мин. 10 символов) или запишите голосовое сообщение")

    # Валидация аудио
    if audio and audio.filename:
        if audio.content_type and audio.content_type not in ALLOWED_AUDIO_TYPES:
            raise BadRequestException(f"Формат аудио не поддерживается: {audio.content_type}")
        audio_bytes = await audio.read()
        if len(audio_bytes) > settings.MAX_FEEDBACK_AUDIO_SIZE:
            raise BadRequestException("Аудио слишком большое (макс. 10 МБ)")
        await audio.seek(0)

    # Валидация вложений
    valid_attachments: list[UploadFile] = []
    for att in attachments:
        if not att.filename:
            continue
        if att.content_type and att.content_type not in ALLOWED_IMAGE_TYPES:
            raise BadRequestException(f"Формат файла не поддерживается: {att.content_type}")
        att_bytes = await att.read()
        if len(att_bytes) > settings.MAX_FEEDBACK_IMAGE_SIZE:
            raise BadRequestException(f"Файл '{att.filename}' слишком большой (макс. 5 МБ)")
        await att.seek(0)
        valid_attachments.append(att)

    if len(valid_attachments) > settings.MAX_FEEDBACK_ATTACHMENTS:
        raise BadRequestException(f"Максимум {settings.MAX_FEEDBACK_ATTACHMENTS} вложений")

    fb = await svc.create_feedback(
        db,
        user_id=uuid.UUID(current_user.sub),
        content=content.strip() if content else None,
        page_url=page_url,
        audio=audio if (audio and audio.filename) else None,
        attachments=valid_attachments,
    )
    await db.commit()
    await db.refresh(fb)
    return FeedbackSchema.model_validate(fb)


@router.get("/{feedback_id}/messages", response_model=list[FeedbackMessageSchema])
async def get_messages(
    feedback_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_permission("feedback:write")),
):
    """
    Получить историю AI-диалога для фидбэка.
    Доступно владельцу фидбэка или пользователям с feedback:read.
    """
    fb = await svc.get_feedback(db, feedback_id)
    _check_ownership(fb, current_user)
    messages = await svc.get_messages(db, feedback_id)
    return [FeedbackMessageSchema.model_validate(m) for m in messages]


@router.post("/{feedback_id}/messages", response_model=FeedbackDialogResponseSchema)
async def send_message(
    feedback_id: uuid.UUID,
    data: FeedbackReplySchema,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_permission("feedback:write")),
):
    """
    Отправить ответ в AI-диалог.
    AI генерирует следующий вопрос или автоматически финализирует после MAX_DIALOG_TURNS.
    """
    fb = await svc.get_feedback(db, feedback_id)
    _check_ownership(fb, current_user)

    fb, _ai_msg = await svc.process_user_reply(db, fb, data.content)
    await db.commit()
    await db.refresh(fb)

    messages = await svc.get_messages(db, feedback_id)
    return FeedbackDialogResponseSchema(
        feedback_status=fb.status,
        messages=[FeedbackMessageSchema.model_validate(m) for m in messages],
        is_finalized=(fb.status == FeedbackStatus.confirmed),
    )


@router.post("/{feedback_id}/confirm", response_model=FeedbackSchema)
async def confirm_feedback(
    feedback_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_permission("feedback:write")),
):
    """
    Пользователь подтвердил фидбэк.
    AI формирует финальную инструкцию и сохраняет в БД (status=confirmed).
    Внешний бот заберёт подтверждённые фидбэки через GET /feedback?status=confirmed.
    """
    fb = await svc.get_feedback(db, feedback_id)
    _check_ownership(fb, current_user)

    fb = await svc.confirm_feedback(db, fb)
    await db.commit()
    await db.refresh(fb)
    return FeedbackSchema.model_validate(fb)


@router.get("", response_model=PaginatedFeedbackSchema)
async def list_feedback(
    status: FeedbackStatus | None = Query(None),
    category: FeedbackCategory | None = Query(None),
    priority: FeedbackPriority | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_permission("feedback:read")),
):
    """Список обратной связи (для администраторов)."""
    items, total = await svc.list_feedback(
        db, status=status, category=category, priority=priority,
        limit=limit, offset=offset,
    )
    return PaginatedFeedbackSchema(
        items=[FeedbackSchema.model_validate(fb) for fb in items],
        total=total,
    )


@router.get("/count")
async def feedback_count(
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_permission("feedback:read")),
):
    """Кол-во подтверждённых + новых обращений (для бейджа)."""
    count = await svc.count_new(db)
    return {"count": count}


@router.get("/{feedback_id}", response_model=FeedbackSchema)
async def get_feedback(
    feedback_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_permission("feedback:read")),
):
    """Одна запись обратной связи с вложениями и диалогом."""
    fb = await svc.get_feedback(db, feedback_id)
    return FeedbackSchema.model_validate(fb)


@router.patch("/{feedback_id}", response_model=FeedbackSchema)
async def update_feedback(
    feedback_id: uuid.UUID,
    data: FeedbackUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_permission("feedback:manage")),
):
    """Обновить статус / заметки администратора."""
    fb = await svc.update_feedback(db, feedback_id, data)
    await db.commit()
    return FeedbackSchema.model_validate(fb)


@router.get("/attachments/{attachment_id}")
async def download_attachment(
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: TokenPayload = Depends(require_permission("feedback:read")),
):
    """Скачать вложение (аутентифицированный доступ)."""
    att = await svc.get_attachment(db, attachment_id)
    abs_path = get_absolute_path(att.file_path)
    if not abs_path.exists():
        raise BadRequestException("Файл не найден на диске")
    return FileResponse(
        path=str(abs_path),
        media_type=att.mime_type,
        filename=att.file_name,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_ownership(fb, current_user: TokenPayload) -> None:
    """Проверяет что current_user является владельцем фидбэка.
    Пользователи с feedback:read (админы) имеют доступ ко всему.
    """
    # Проверяем permissions — если в токене есть feedback:read, пропускаем
    perms: list[str] = getattr(current_user, "permissions", []) or []
    if "feedback:read" in perms:
        return
    if fb.user_id is None or str(fb.user_id) != current_user.sub:
        raise ForbiddenException("Доступ запрещён")
