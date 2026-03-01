"""Feedback file storage — сохранение вложений на диск."""
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/wav", "audio/mpeg"}


def _feedback_dir(feedback_id: uuid.UUID) -> Path:
    """Директория для вложений конкретного фидбэка."""
    settings = get_settings()
    d = Path(settings.UPLOAD_DIR) / "feedback" / str(feedback_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


async def save_upload(file: UploadFile, feedback_id: uuid.UUID) -> tuple[str, int]:
    """
    Сохранить файл на диск.

    Returns:
        (relative_path, file_size)
    """
    d = _feedback_dir(feedback_id)
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename or 'file'}"
    dest = d / safe_name

    content = await file.read()
    dest.write_bytes(content)

    rel_path = str(dest.relative_to(Path(get_settings().UPLOAD_DIR)))
    return rel_path, len(content)


def get_absolute_path(relative_path: str) -> Path:
    """Абсолютный путь к файлу по относительному пути из БД."""
    settings = get_settings()
    return Path(settings.UPLOAD_DIR) / relative_path
