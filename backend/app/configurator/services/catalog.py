"""Catalog service — field definitions, visibility rules, models, groups, catalog."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ConflictException, NotFoundException
from app.configurator.models import (
    DoorFieldDefinition,
    DoorFieldGroup,
    DoorFieldVisibilityRule,
    DoorModel,
)
from app.configurator.schemas import (
    ConfiguratorCatalogSchema,
    VisibilityRuleCreateSchema,
)


# ─── Field Definitions ────────────────────────────────────────────────────────

async def get_all_field_definitions(
    db: AsyncSession, *, active_only: bool = True
) -> list[DoorFieldDefinition]:
    q = select(DoorFieldDefinition).order_by(
        DoorFieldDefinition.sort_order, DoorFieldDefinition.code
    )
    if active_only:
        q = q.where(DoorFieldDefinition.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_field_definition_by_code(db: AsyncSession, code: str) -> DoorFieldDefinition:
    result = await db.execute(
        select(DoorFieldDefinition).where(DoorFieldDefinition.code == code)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Поле '{code}' не найдено")
    return obj


async def create_field_definition(db: AsyncSession, data: dict) -> DoorFieldDefinition:
    existing = await db.execute(
        select(DoorFieldDefinition).where(DoorFieldDefinition.code == data["code"])
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Поле с кодом '{data['code']}' уже существует")

    if "options" in data and data["options"] is not None:
        data = dict(data)
        data["options"] = [
            opt if isinstance(opt, dict) else opt.model_dump()
            for opt in data["options"]
        ]

    obj = DoorFieldDefinition(**data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def update_field_definition(
    db: AsyncSession, code: str, data: dict
) -> DoorFieldDefinition:
    obj = await get_field_definition_by_code(db, code)
    if "options" in data and data["options"] is not None:
        data["options"] = [
            opt if isinstance(opt, dict) else opt.model_dump()
            for opt in data["options"]
        ]
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


# ─── Visibility Rules ─────────────────────────────────────────────────────────

async def get_visibility_rules(db: AsyncSession) -> list[DoorFieldVisibilityRule]:
    result = await db.execute(select(DoorFieldVisibilityRule))
    return list(result.scalars().all())


async def create_visibility_rule(
    db: AsyncSession, data: VisibilityRuleCreateSchema
) -> DoorFieldVisibilityRule:
    await get_field_definition_by_code(db, data.field_code)
    obj = DoorFieldVisibilityRule(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_visibility_rule(db: AsyncSession, rule_id: uuid.UUID) -> None:
    result = await db.execute(
        select(DoorFieldVisibilityRule).where(DoorFieldVisibilityRule.id == rule_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Правило видимости {rule_id} не найдено")
    await db.delete(obj)


# ─── Door Models ─────────────────────────────────────────────────────────────

async def get_all_models(
    db: AsyncSession, *, active_only: bool = True
) -> list[DoorModel]:
    q = select(DoorModel).order_by(DoorModel.sort_order, DoorModel.code)
    if active_only:
        q = q.where(DoorModel.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_model_by_code(db: AsyncSession, code: str) -> DoorModel:
    result = await db.execute(
        select(DoorModel).where(DoorModel.code == code)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Модель '{code}' не найдена")
    return obj


async def create_model(db: AsyncSession, data: dict) -> DoorModel:
    existing = await db.execute(
        select(DoorModel).where(DoorModel.code == data["code"])
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Модель с кодом '{data['code']}' уже существует")
    obj = DoorModel(**data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def update_model(db: AsyncSession, code: str, data: dict) -> DoorModel:
    obj = await get_model_by_code(db, code)
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_model(db: AsyncSession, code: str) -> None:
    obj = await get_model_by_code(db, code)
    await db.delete(obj)


# ─── Door Field Groups ───────────────────────────────────────────────────────

async def get_all_groups(
    db: AsyncSession, *, active_only: bool = True
) -> list[DoorFieldGroup]:
    q = select(DoorFieldGroup).order_by(DoorFieldGroup.sort_order, DoorFieldGroup.code)
    if active_only:
        q = q.where(DoorFieldGroup.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_group_by_code(db: AsyncSession, code: str) -> DoorFieldGroup:
    result = await db.execute(
        select(DoorFieldGroup).where(DoorFieldGroup.code == code)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Секция '{code}' не найдена")
    return obj


async def create_group(db: AsyncSession, data: dict) -> DoorFieldGroup:
    existing = await db.execute(
        select(DoorFieldGroup).where(DoorFieldGroup.code == data["code"])
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Секция с кодом '{data['code']}' уже существует")
    obj = DoorFieldGroup(**data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def update_group(db: AsyncSession, code: str, data: dict) -> DoorFieldGroup:
    obj = await get_group_by_code(db, code)
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_group(db: AsyncSession, code: str) -> None:
    obj = await get_group_by_code(db, code)
    await db.delete(obj)


# ─── Configurator Catalog ─────────────────────────────────────────────────────

async def get_configurator_catalog(db: AsyncSession) -> ConfiguratorCatalogSchema:
    """Возвращает все поля + правила + модели + группы одним запросом для фронтенда."""
    fields = await get_all_field_definitions(db, active_only=True)
    rules = await get_visibility_rules(db)
    groups = await get_all_groups(db, active_only=True)
    models = await get_all_models(db, active_only=True)

    from app.configurator.schemas import (
        DoorFieldDefinitionSchema,
        DoorFieldGroupSchema,
        DoorModelSchema,
        VisibilityRuleSchema,
    )

    return ConfiguratorCatalogSchema(
        field_definitions=[DoorFieldDefinitionSchema.model_validate(f) for f in fields],
        visibility_rules=[VisibilityRuleSchema.model_validate(r) for r in rules],
        groups=[DoorFieldGroupSchema.model_validate(g) for g in groups],
        models=[DoorModelSchema.model_validate(m) for m in models],
    )
