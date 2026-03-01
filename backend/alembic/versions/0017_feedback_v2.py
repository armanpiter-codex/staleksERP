"""Feedback v2 — AI-диалог: feedback_messages, новые статусы, dialog_turns, final_instruction

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-01

Sprint 15:
- ALTER feedback_status_enum: добавить 'clarifying', 'confirmed'
- CREATE TYPE feedback_message_role_enum (user, assistant)
- ALTER feedback: добавить dialog_turns, final_instruction
- CREATE TABLE feedback_messages
"""
import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Новые значения в feedback_status_enum
    #    ADD VALUE IF NOT EXISTS нельзя в транзакции на Postgres < 12 — но мы на 15+
    op.execute(sa.text(
        "ALTER TYPE feedback_status_enum ADD VALUE IF NOT EXISTS 'clarifying';"
    ))
    op.execute(sa.text(
        "ALTER TYPE feedback_status_enum ADD VALUE IF NOT EXISTS 'confirmed';"
    ))

    # 2. Новый enum для роли сообщения в диалоге
    op.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE feedback_message_role_enum AS ENUM ('user', 'assistant');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    # 3. Новые колонки в таблице feedback
    op.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE feedback ADD COLUMN dialog_turns INTEGER NOT NULL DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """))
    op.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE feedback ADD COLUMN final_instruction TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """))

    # 4. Таблица диалога
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS feedback_messages (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feedback_id UUID NOT NULL
                REFERENCES feedback(id) ON DELETE CASCADE,
            role        feedback_message_role_enum NOT NULL,
            content     TEXT NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """))
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_feedback_messages_feedback_id
            ON feedback_messages(feedback_id);
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS feedback_messages;"))
    op.execute(sa.text("DROP TYPE IF EXISTS feedback_message_role_enum;"))
    op.execute(sa.text(
        "ALTER TABLE feedback DROP COLUMN IF EXISTS dialog_turns;"
    ))
    op.execute(sa.text(
        "ALTER TABLE feedback DROP COLUMN IF EXISTS final_instruction;"
    ))
    # Enum значения нельзя удалить в Postgres без пересоздания типа
