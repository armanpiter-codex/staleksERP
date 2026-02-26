"""
Seed script: initial roles, permissions, and owner user.
Run via: docker compose exec backend python -m app.scripts.seed_db
"""
import asyncio
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.models import Permission, Role, RolePermission, User, UserRole
from app.auth.security import hash_password
from app.config import get_settings

settings = get_settings()

# ---- Permission definitions ----
PERMISSIONS = [
    # Auth
    ("auth:manage_users", "Manage users", "auth"),
    ("auth:manage_roles", "Manage roles and permissions", "auth"),
    # Orders
    ("orders:read", "Read all orders", "orders"),
    ("orders:write", "Create and update orders", "orders"),
    ("orders:delete", "Delete orders", "orders"),
    ("orders:read_b2b", "Read B2B orders", "orders"),
    ("orders:write_b2b", "Create/update B2B orders", "orders"),
    ("orders:read_b2c", "Read B2C orders", "orders"),
    ("orders:write_b2c", "Create/update B2C orders", "orders"),
    # Configurator
    ("configurator:view", "View configurations and catalog", "configurator"),
    ("configurator:create", "Create door configurations", "configurator"),
    ("configurator:edit", "Edit configurations and markings", "configurator"),
    ("configurator:admin", "Manage fields, prices, visibility rules", "configurator"),
    # KP (Commercial proposals)
    ("kp:generate", "Generate KP PDF", "kp"),
    ("kp:view_all", "View all KP documents", "kp"),
    # Production
    ("production:read", "Read production orders", "production"),
    ("production:manage", "Manage production queue", "production"),
    ("production:workshop_own", "Manage own workshop only", "production"),
    # Tech cards
    ("techcard:read", "View tech cards", "techcard"),
    ("techcard:write", "Create and edit tech cards", "techcard"),
    # Timesheet
    ("timesheet:log_self", "Log own work time via QR", "timesheet"),
    ("timesheet:view_all", "View all timesheet records", "timesheet"),
    # Notifications
    ("notifications:receive", "Receive system notifications", "notifications"),
    # Dashboard
    ("dashboard:owner", "Full owner analytics dashboard", "dashboard"),
    ("dashboard:foreman", "Workshop-level analytics", "dashboard"),
    # Administration
    ("admin:directories", "Manage system directories", "admin"),
    ("admin:integrations", "Manage integrations (Bitrix, Telegram)", "admin"),
    ("admin:system", "Full system administration", "admin"),
    # Door transitions (Sprint 3)
    ("doors:transition_to_in_production", "Move door to in_production status", "orders"),
    ("doors:transition_to_ready", "Move door to ready_for_shipment status", "orders"),
    ("doors:transition_to_shipped", "Move door to shipped status", "orders"),
    ("doors:transition_to_completed", "Move door to completed status", "orders"),
    # Warehouse (Sprint 3)
    ("warehouse:manage", "Manage finished goods warehouse", "warehouse"),
    ("warehouse:view", "View finished goods warehouse", "warehouse"),
]

# ---- Role definitions ----
# Format: (name, display_name, description, is_system, [permission_codes])
ROLES = [
    (
        "owner",
        "Владелец",
        "Полный доступ ко всей системе включая финансы",
        True,
        [p[0] for p in PERMISSIONS],  # All permissions
    ),
    (
        "admin",
        "Администратор",
        "Управление ролями, справочниками, интеграциями",
        True,
        [
            "auth:manage_users", "auth:manage_roles",
            "orders:read", "orders:write",
            "orders:read_b2b", "orders:write_b2b",
            "orders:read_b2c", "orders:write_b2c",
            "doors:transition_to_in_production", "doors:transition_to_ready",
            "doors:transition_to_shipped", "doors:transition_to_completed",
            "configurator:view", "configurator:create", "configurator:edit", "configurator:admin",
            "kp:generate", "kp:view_all",
            "production:read", "production:manage",
            "techcard:read", "techcard:write",
            "timesheet:log_self", "timesheet:view_all",
            "notifications:receive",
            "dashboard:foreman",
            "admin:directories", "admin:integrations", "admin:system",
            "warehouse:manage", "warehouse:view",
        ],
    ),
    (
        "b2b_manager",
        "Менеджер B2B",
        "Работа с B2B заказами, КП, клиентами-строителями",
        True,
        [
            "orders:read", "orders:write", "orders:read_b2b", "orders:write_b2b",
            "doors:transition_to_in_production", "doors:transition_to_completed",
            "configurator:view", "configurator:create", "configurator:edit",
            "kp:generate",
            "production:read", "techcard:read",
            "notifications:receive",
        ],
    ),
    (
        "b2c_manager",
        "Менеджер B2C",
        "Работа с B2C заказами, частными клиентами",
        True,
        [
            "orders:read", "orders:write", "orders:read_b2c", "orders:write_b2c",
            "doors:transition_to_in_production", "doors:transition_to_completed",
            "configurator:view", "configurator:create", "configurator:edit",
            "kp:generate",
            "production:read", "techcard:read",
            "notifications:receive",
        ],
    ),
    (
        "measurer",
        "Замерщик / Сервисник",
        "Электронный замерный лист на выезде, мобильный интерфейс",
        True,
        [
            "orders:read",
            "configurator:view", "configurator:create",
            "production:read",
            "notifications:receive",
        ],
    ),
    (
        "foreman",
        "Бригадир цеха",
        "Управление своим цехом, QR-табель",
        True,
        [
            "doors:transition_to_in_production", "doors:transition_to_ready",
            "production:read", "production:manage", "production:workshop_own",
            "techcard:read", "techcard:write",
            "timesheet:log_self", "timesheet:view_all",
            "notifications:receive",
            "dashboard:foreman",
        ],
    ),
    (
        "worker",
        "Рабочий",
        "Просмотр техкарты своей позиции, QR-табель",
        True,
        [
            "doors:transition_to_ready",
            "production:read",
            "techcard:read",
            "timesheet:log_self",
            "notifications:receive",
        ],
    ),
    (
        "technologist",
        "Технолог",
        "Настройка конфигуратора: модели, секции, поля, видимость",
        True,
        [
            "configurator:view", "configurator:create",
            "configurator:edit", "configurator:admin",
        ],
    ),
    # Sprint 3: new roles
    (
        "warehouse_manager",
        "Менеджер склада ГП",
        "Управление складом готовой продукции, отгрузка",
        True,
        [
            "doors:transition_to_shipped",
            "warehouse:manage", "warehouse:view",
            "orders:read",
            "production:read",
            "notifications:receive",
        ],
    ),
    (
        "warehouse_worker",
        "Работник склада ГП",
        "Просмотр склада, отметка отгрузки",
        True,
        [
            "doors:transition_to_shipped",
            "warehouse:view",
            "orders:read",
            "production:read",
            "notifications:receive",
        ],
    ),
    (
        "installation_foreman",
        "Бригадир монтажа",
        "Монтаж дверей у клиента, завершение дверей",
        True,
        [
            "doors:transition_to_completed",
            "orders:read",
            "production:read",
            "timesheet:log_self", "timesheet:view_all",
            "notifications:receive",
        ],
    ),
]

# ---- Initial owner user ----
OWNER_USERNAME = os.getenv("OWNER_USERNAME", "owner")
OWNER_PASSWORD = os.getenv("OWNER_PASSWORD", "ChangeMe123!")
OWNER_FULL_NAME = os.getenv("OWNER_FULL_NAME", "Владелец системы")
OWNER_EMAIL = os.getenv("OWNER_EMAIL", "owner@staleks.local")


async def seed(db: AsyncSession) -> None:
    from sqlalchemy import select

    print("Seeding permissions...")
    perm_map: dict[str, Permission] = {}

    for code, description, module in PERMISSIONS:
        result = await db.execute(select(Permission).where(Permission.code == code))
        existing = result.scalar_one_or_none()
        if not existing:
            perm = Permission(code=code, description=description, module=module)
            db.add(perm)
            await db.flush()
            perm_map[code] = perm
            print(f"  + permission: {code}")
        else:
            perm_map[code] = existing

    print("Seeding roles...")
    for name, display_name, description, is_system, perm_codes in ROLES:
        result = await db.execute(select(Role).where(Role.name == name))
        role = result.scalar_one_or_none()

        if not role:
            role = Role(
                name=name,
                display_name=display_name,
                description=description,
                is_system=is_system,
            )
            db.add(role)
            await db.flush()
            print(f"  + role: {name}")
        else:
            print(f"  ~ role exists: {name}")

        # Sync permissions for this role
        from sqlalchemy import delete
        await db.execute(
            delete(RolePermission).where(RolePermission.role_id == role.id)
        )
        for code in perm_codes:
            if code in perm_map:
                rp = RolePermission(role_id=role.id, permission_id=perm_map[code].id)
                db.add(rp)
        await db.flush()

    print("Seeding owner user...")
    result = await db.execute(select(User).where(User.username == OWNER_USERNAME))
    owner = result.scalar_one_or_none()

    if not owner:
        owner = User(
            username=OWNER_USERNAME,
            full_name=OWNER_FULL_NAME,
            email=OWNER_EMAIL,
            hashed_password=hash_password(OWNER_PASSWORD),
            is_active=True,
            is_verified=True,
        )
        db.add(owner)
        await db.flush()

        # Assign owner role
        result = await db.execute(select(Role).where(Role.name == "owner"))
        owner_role = result.scalar_one_or_none()
        if owner_role:
            user_role = UserRole(user_id=owner.id, role_id=owner_role.id)
            db.add(user_role)

        await db.flush()
        print(f"  + owner user created: {OWNER_USERNAME} / {OWNER_PASSWORD}")
        print("  !! CHANGE THE OWNER PASSWORD AFTER FIRST LOGIN !!")
    else:
        print(f"  ~ owner user exists: {OWNER_USERNAME}")

    # Create test technologist user
    print("Seeding technologist user...")
    result = await db.execute(select(User).where(User.username == "technologist"))
    tech_user = result.scalar_one_or_none()

    if not tech_user:
        tech_user = User(
            username="technologist",
            full_name="Технолог",
            email="tech@staleks.local",
            hashed_password=hash_password("ChangeMe123!"),
            is_active=True,
            is_verified=True,
        )
        db.add(tech_user)
        await db.flush()

        result = await db.execute(select(Role).where(Role.name == "technologist"))
        tech_role = result.scalar_one_or_none()
        if tech_role:
            user_role = UserRole(user_id=tech_user.id, role_id=tech_role.id)
            db.add(user_role)

        await db.flush()
        print("  + technologist user created: technologist / ChangeMe123!")
    else:
        print("  ~ technologist user exists")

    await db.commit()
    print("\nSeed complete!")


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        await seed(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
