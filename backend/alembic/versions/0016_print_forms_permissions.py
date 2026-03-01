"""print forms + role permission management

Revision ID: 0016
Revises: 0015
Create Date: 2026-03-01

Sprint 14:
- ALTER door_field_definitions: is_print, print_order
- New permission: auth:manage_permissions
- Assign to owner, admin, technologist
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add is_print column to door_field_definitions
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE door_field_definitions
                ADD COLUMN is_print BOOLEAN NOT NULL DEFAULT true;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """))

    # 2. Add print_order column to door_field_definitions
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE door_field_definitions
                ADD COLUMN print_order INTEGER;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """))

    # 3. New permission: auth:manage_permissions
    conn.execute(sa.text("""
        INSERT INTO permissions (id, code, description, module)
        VALUES (gen_random_uuid(), 'auth:manage_permissions', 'Manage role permission assignments', 'auth')
        ON CONFLICT (code) DO NOTHING;
    """))

    # 4. Assign auth:manage_permissions to owner, admin, technologist
    conn.execute(sa.text("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.name IN ('owner', 'admin', 'technologist')
          AND p.code = 'auth:manage_permissions'
        ON CONFLICT DO NOTHING;
    """))


def downgrade() -> None:
    conn = op.get_bind()

    # Remove permission assignments
    conn.execute(sa.text("""
        DELETE FROM role_permissions
        WHERE permission_id IN (
            SELECT id FROM permissions WHERE code = 'auth:manage_permissions'
        );
    """))

    # Remove permission
    conn.execute(sa.text("""
        DELETE FROM permissions WHERE code = 'auth:manage_permissions';
    """))

    # Remove columns
    conn.execute(sa.text("""
        ALTER TABLE door_field_definitions DROP COLUMN IF EXISTS print_order;
    """))
    conn.execute(sa.text("""
        ALTER TABLE door_field_definitions DROP COLUMN IF EXISTS is_print;
    """))
