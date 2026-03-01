"""production workshops: цеха, фазы маршрутов, прогресс по цехам

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-01

Sprint 16 — Цеха и параллельные маршруты:
- production_workshops: сущность цеха (Металл, МДФ, Сборка)
- ALTER production_stages: workshop_id FK
- ALTER production_routes: phase + workshop_id, drop old unique constraint
- door_workshop_progress: отслеживание прогресса двери по цехам/фазам
- 1 новое право production:workshops
- 3 seed-цеха + привязка существующих этапов
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# ─── Seed data ───────────────────────────────────────────────────────────────

SEED_WORKSHOPS = [
    ("metal",    "Металл", "#EF4444", 10),
    ("mdf",      "МДФ",    "#F59E0B", 20),
    ("assembly", "Сборка", "#3B82F6", 30),
]

STAGE_WORKSHOP_MAP = {
    "design":     "metal",
    "metal_cut":  "metal",
    "metal_weld": "metal",
    "mdf":        "mdf",
    "painting":   "assembly",
    "assembly":   "assembly",
    "qc":         "assembly",
}


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Table: production_workshops
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS production_workshops (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            color VARCHAR(7),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_production_workshops_code ON production_workshops(code)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_production_workshops_sort_order ON production_workshops(sort_order)"
    ))

    # 2. Seed workshops
    for code, name, color, sort_order in SEED_WORKSHOPS:
        conn.execute(sa.text(
            "INSERT INTO production_workshops (id, code, name, color, sort_order) "
            "VALUES (gen_random_uuid(), :code, :name, :color, :sort_order) "
            "ON CONFLICT (code) DO NOTHING"
        ), {"code": code, "name": name, "color": color, "sort_order": sort_order})

    # 3. ALTER production_stages: add workshop_id
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_stages
                ADD COLUMN workshop_id UUID REFERENCES production_workshops(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_production_stages_workshop ON production_stages(workshop_id)"
    ))

    # 4. Update existing stages with workshop assignments
    for stage_code, workshop_code in STAGE_WORKSHOP_MAP.items():
        conn.execute(sa.text(
            "UPDATE production_stages "
            "SET workshop_id = (SELECT id FROM production_workshops WHERE code = :workshop_code) "
            "WHERE code = :stage_code AND workshop_id IS NULL"
        ), {"stage_code": stage_code, "workshop_code": workshop_code})

    # 5. ALTER production_routes: add phase and workshop_id columns
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_routes
                ADD COLUMN phase INTEGER NOT NULL DEFAULT 1;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_routes
                ADD COLUMN workshop_id UUID REFERENCES production_workshops(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """))

    # 6. Drop old unique constraint (step_order was globally unique per model,
    #    now step_order is unique per model+phase+workshop)
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_routes DROP CONSTRAINT IF EXISTS uq_route_model_step;
        EXCEPTION WHEN undefined_object THEN NULL;
        END $$;
    """))

    # 7. New unique index: model + phase + workshop + step_order
    conn.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_route_model_phase_workshop_step
            ON production_routes(door_model_id, phase, workshop_id, step_order)
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_production_routes_phase ON production_routes(door_model_id, phase)"
    ))

    # 8. Table: door_workshop_progress
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS door_workshop_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            door_id UUID NOT NULL REFERENCES order_doors(id) ON DELETE CASCADE,
            workshop_id UUID NOT NULL REFERENCES production_workshops(id) ON DELETE CASCADE,
            phase INTEGER NOT NULL,
            current_stage_id UUID REFERENCES production_stages(id) ON DELETE SET NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_door_workshop_phase UNIQUE (door_id, workshop_id, phase)
        )
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_dwp_door ON door_workshop_progress(door_id)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_dwp_stage ON door_workshop_progress(current_stage_id)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_dwp_status ON door_workshop_progress(status)"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS idx_dwp_workshop ON door_workshop_progress(workshop_id)"
    ))

    # 9. Permission: production:workshops
    conn.execute(sa.text(
        "INSERT INTO permissions (id, code, description, module) "
        "VALUES (gen_random_uuid(), 'production:workshops', "
        "'Управление цехами производства', 'production') "
        "ON CONFLICT (code) DO NOTHING"
    ))
    for role_name in ("owner", "admin", "technologist"):
        conn.execute(sa.text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = :role_name AND p.code = 'production:workshops' "
            "ON CONFLICT DO NOTHING"
        ), {"role_name": role_name})

    # 10. Defensive: if any doors are in production with current_stage_id set,
    #     create progress entries for them (single phase, workshop from stage)
    conn.execute(sa.text("""
        INSERT INTO door_workshop_progress (id, door_id, workshop_id, phase, current_stage_id, status, started_at)
        SELECT
            gen_random_uuid(),
            od.id,
            ps.workshop_id,
            1,
            od.current_stage_id,
            'active',
            NOW()
        FROM order_doors od
        JOIN production_stages ps ON ps.id = od.current_stage_id
        WHERE od.status = 'in_production'
          AND od.current_stage_id IS NOT NULL
          AND ps.workshop_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM door_workshop_progress dwp WHERE dwp.door_id = od.id
          )
    """))


def downgrade() -> None:
    conn = op.get_bind()

    # Remove role_permissions
    conn.execute(sa.text(
        "DELETE FROM role_permissions WHERE permission_id IN "
        "(SELECT id FROM permissions WHERE code = 'production:workshops')"
    ))
    conn.execute(sa.text("DELETE FROM permissions WHERE code = 'production:workshops'"))

    # Drop door_workshop_progress
    conn.execute(sa.text("DROP TABLE IF EXISTS door_workshop_progress"))

    # Restore old unique constraint on production_routes
    conn.execute(sa.text("DROP INDEX IF EXISTS uq_route_model_phase_workshop_step"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_production_routes_phase"))
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_routes DROP COLUMN IF EXISTS workshop_id;
        END $$;
    """))
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_routes DROP COLUMN IF EXISTS phase;
        END $$;
    """))
    # Recreate original constraint (may fail if duplicate step_orders exist)
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_routes
                ADD CONSTRAINT uq_route_model_step UNIQUE (door_model_id, step_order);
        EXCEPTION WHEN duplicate_key THEN NULL;
        END $$;
    """))

    # Drop workshop_id from stages
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_production_stages_workshop"))
    conn.execute(sa.text("""
        DO $$ BEGIN
            ALTER TABLE production_stages DROP COLUMN IF EXISTS workshop_id;
        END $$;
    """))

    # Drop workshops table
    conn.execute(sa.text("DROP TABLE IF EXISTS production_workshops"))
