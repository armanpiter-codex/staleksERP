"""Feedback AI — OpenAI Whisper (голос→текст) + GPT-4o-mini (категоризация)."""
import json
import logging
from pathlib import Path

logger = logging.getLogger("staleks_erp.feedback.ai")


def _get_api_key() -> str | None:
    from app.config import get_settings
    return get_settings().OPENAI_API_KEY


async def transcribe_audio(file_path: str | Path) -> str | None:
    """
    Транскрибировать аудиофайл через OpenAI Whisper.
    Возвращает текст или None (если ключ отсутствует или ошибка).
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        import httpx

        path = Path(file_path)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": (path.name, path.read_bytes(), "audio/webm")},
                data={"model": "whisper-1", "language": "ru"},
            )
            resp.raise_for_status()
            return resp.json().get("text", "").strip() or None
    except Exception as exc:
        logger.warning("Whisper transcription failed: %s", exc)
        return None


async def categorize_feedback(content: str, user_category: str) -> dict | None:
    """
    Категоризировать фидбэк через GPT-4o-mini.
    Возвращает {"category": str, "priority": str, "summary": str} или None.
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        import httpx

        prompt = (
            "Ты — AI-ассистент системы Staleks ERP (производство стальных дверей, Казахстан).\n"
            "Пользователь оставил обратную связь.\n\n"
            f"Категория от пользователя: {user_category}\n"
            f"Текст:\n{content}\n\n"
            "Верни JSON (и только JSON, без markdown):\n"
            '{"category": "bug|suggestion|question|other", '
            '"priority": "high|medium|low", '
            '"summary": "краткое резюме на русском, 1-2 предложения"}'
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 200,
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            return json.loads(text)
    except Exception as exc:
        logger.warning("GPT categorization failed: %s", exc)
        return None
