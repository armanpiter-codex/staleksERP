"""feedback module: таблицы feedback + feedback_attachments, права

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-01

Модуль обратной связи — пользователи ERP оставляют баги, пожелания,
вопросы (текст/голос/скриншоты). AI категоризирует через OpenAI.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Права
NEW_PERMISSIONS = [
    ("feedback:write", "Отправить обратную связь", "feedback"),
    ("feedback:read", "Просмотр обратной связи", "feedback"),
    ("feedback:manage", "Управление обратной связью (статус, заметки)", "feedback"),
]

# feedback:write — всем ролям
ALL_ROLES = [
    "owner", "admin", "b2b_manager", "b2c_manager", "measurer",
    "foreman", "worker", "technologist", "warehouse_manager",
    "warehouse_worker", "installation_foreman",
]

# feedback:read + feedback:manage — только owner и admin
ADMIN_ROLES = ["owner", "admin"]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Enum types
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE feedback_category_enum AS ENUM ('bug', 'suggestion', 'question', 'other');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE feedback_priority_enum AS ENUM ('high', 'medium', 'low');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE feedback_status_enum AS ENUM ('new', 'reviewing', 'resolved', 'closed');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE feedback_file_type_enum AS ENUM ('image', 'audio', 'document');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    # 2. Table: feedback
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS feedback (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            content TEXT NOT NULL,
            category feedback_category_enum NOT NULL DEFAULT 'other',
            priority feedback_priority_enum,
            status feedback_status_enum NOT NULL DEFAULT 'new',
            page_url VARCHAR(500),
            voice_transcript TEXT,
            ai_summary TEXT,
            ai_category feedback_category_enum,
            admin_notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))

    # 3. Table: feedback_attachments
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS feedback_attachments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_type feedback_file_type_enum NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            file_size INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))

    # 4. Indexes
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_feedback_att_feedback_id ON feedback_attachments(feedback_id)"))

    # 5. Permissions
    for code, description, module in NEW_PERMISSIONS:
        conn.execute(sa.text(
            "INSERT INTO permissions (id, code, description, module) "
            "VALUES (gen_random_uuid(), :code, :description, :module) "
            "ON CONFLICT (code) DO NOTHING"
        ), {"code": code, "description": description, "module": module})

    # 6. feedback:write → все роли
    for role_name in ALL_ROLES:
        conn.execute(sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = :role_name AND p.code = 'feedback:write' "
            "ON CONFLICT DO NOTHING"
        ), {"role_name": role_name})

    # 7. feedback:read + feedback:manage → owner, admin
    for role_name in ADMIN_ROLES:
        for perm_code in ("feedback:read", "feedback:manage"):
            conn.execute(sa.text(
                "INSERT INTO role_permissions (role_id, permission_id) "
                "SELECT r.id, p.id FROM roles r, permissions p "
                "WHERE r.name = :role_name AND p.code = :perm_code "
                "ON CONFLICT DO NOTHING"
            ), {"role_name": role_name, "perm_code": perm_code})


def downgrade() -> None:
    conn = op.get_bind()

    # Remove role_permissions
    for perm_code in ("feedback:write", "feedback:read", "feedback:manage"):
        conn.execute(sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN "
            "(SELECT id FROM permissions WHERE code = :code)"
        ), {"code": perm_code})

    # Remove permissions
    for code, _, _ in NEW_PERMISSIONS:
        conn.execute(sa.text("DELETE FROM permissions WHERE code = :code"), {"code": code})

    # Drop tables
    conn.execute(sa.text("DROP TABLE IF EXISTS feedback_attachments"))
    conn.execute(sa.text("DROP TABLE IF EXISTS feedback"))

    # Drop enum types
    conn.execute(sa.text("DROP TYPE IF EXISTS feedback_file_type_enum"))
    conn.execute(sa.text("DROP TYPE IF EXISTS feedback_status_enum"))
    conn.execute(sa.text("DROP TYPE IF EXISTS feedback_priority_enum"))
    conn.execute(sa.text("DROP TYPE IF EXISTS feedback_category_enum"))
