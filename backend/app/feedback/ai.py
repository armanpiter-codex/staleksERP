"""Feedback AI — OpenAI Whisper (голос→текст) + GPT-4o-mini (диалог и финализация)."""
import json
import logging
from pathlib import Path

logger = logging.getLogger("staleks_erp.feedback.ai")

# Максимальное кол-во ответов пользователя до авто-финализации
MAX_DIALOG_TURNS = 3


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
    Используется как fallback при отсутствии диалога.
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


async def clarify_feedback(
    content: str,
    voice_transcript: str | None = None,
) -> str | None:
    """
    Генерирует первый уточняющий вопрос AI после получения фидбэка.
    Возвращает текст вопроса или None при ошибке.
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        import httpx

        # Объединяем текст и транскрипцию если есть
        full_content = content
        if voice_transcript and voice_transcript not in content:
            full_content = f"{content}\n\n[Голосовое сообщение]: {voice_transcript}"

        prompt = (
            "Ты — AI-ассистент системы Staleks ERP (ERP для производства стальных дверей в Казахстане).\n"
            "Пользователь оставил обратную связь. Твоя задача — задать ОДИН уточняющий вопрос, "
            "чтобы лучше понять суть проблемы или пожелания.\n\n"
            f"Обратная связь пользователя:\n{full_content}\n\n"
            "Требования:\n"
            "- Строго один вопрос (не список)\n"
            "- На русском языке, дружелюбный тон\n"
            "- Цель: уточнить что именно нужно изменить, на какой странице/функции, "
            "какое ожидаемое поведение\n"
            "Отвечай только самим вопросом, без вступления."
        )

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 250,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("clarify_feedback failed: %s", exc)
        return None


async def generate_next_message(
    original_content: str,
    messages_history: list[dict],
    is_last_turn: bool = False,
) -> str | None:
    """
    Генерирует следующий ответ AI в диалоге на основе истории переписки.
    messages_history: [{"role": "user"|"assistant", "content": str}, ...]
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        import httpx

        if is_last_turn:
            task_hint = (
                "Это последний вопрос в диалоге. Кратко резюмируй всё что понял "
                "и попроси пользователя подтвердить что ты правильно понял суть запроса."
            )
        else:
            task_hint = "Задай один конкретный уточняющий вопрос на русском языке."

        system_prompt = (
            "Ты — AI-ассистент системы Staleks ERP (ERP для производства стальных дверей в Казахстане).\n"
            "Ты ведёшь диалог с пользователем, чтобы уточнить его обратную связь.\n"
            f"Исходный фидбэк: {original_content}\n\n"
            f"Задача: {task_hint}\n"
            "Будь лаконичным и дружелюбным."
        )

        messages = [{"role": "system", "content": system_prompt}] + messages_history

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "max_tokens": 300,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("generate_next_message failed: %s", exc)
        return None


async def finalize_feedback(
    original_content: str,
    messages_history: list[dict],
    page_url: str | None = None,
) -> dict | None:
    """
    Генерирует финальную инструкцию для разработчика на основе всего диалога.
    Возвращает {"category": str, "priority": str, "summary": str, "instruction": str} или None.
    """
    api_key = _get_api_key()
    if not api_key:
        return None

    try:
        import httpx

        dialog_text = "\n".join(
            f"{'Пользователь' if m['role'] == 'user' else 'AI'}: {m['content']}"
            for m in messages_history
        )

        prompt = (
            "Ты — AI-ассистент системы Staleks ERP (ERP для производства стальных дверей в Казахстане).\n"
            "На основе диалога с пользователем сформируй чёткую инструкцию для разработчика.\n\n"
            f"Исходный фидбэк: {original_content}\n"
            f"Страница: {page_url or 'не указана'}\n\n"
            f"Диалог уточнения:\n{dialog_text}\n\n"
            "Верни JSON (только JSON, без markdown-блоков):\n"
            "{\n"
            '  "category": "bug|suggestion|question|other",\n'
            '  "priority": "high|medium|low",\n'
            '  "summary": "краткое название задачи до 100 символов",\n'
            '  "instruction": "подробная инструкция для разработчика: '
            'что нужно сделать, на какой странице/компоненте, '
            'текущее поведение vs ожидаемое. Используй структурированный текст."\n'
            "}"
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 800,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
            return json.loads(text)
    except Exception as exc:
        logger.warning("finalize_feedback failed: %s", exc)
        return None
