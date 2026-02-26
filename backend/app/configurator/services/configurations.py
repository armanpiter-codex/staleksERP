"""Configurations service — configuration CRUD, markings, price recalculation."""
import uuid
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import BadRequestException, ConflictException, NotFoundException
from app.configurator.models import (
    ConfigurationStatus,
    DoorConfiguration,
    DoorMarking,
    DoorType,
    PricingRule,
)
from app.configurator.schemas import (
    BulkMarkingsImportSchema,
    DoorConfigurationCreateSchema,
    DoorConfigurationUpdateSchema,
    DoorMarkingCreateSchema,
    DoorMarkingUpdateSchema,
    GenerateMarkingsSchema,
)


# ─── Internal ─────────────────────────────────────────────────────────────────

async def _recalculate_prices(db: AsyncSession, config: DoorConfiguration) -> None:
    """Пересчитывает price_estimate и cost_price для конфигурации по pricing_rules."""
    if not config.values:
        return

    field_codes = list(config.values.keys())
    result = await db.execute(
        select(PricingRule).where(PricingRule.field_code.in_(field_codes))
    )
    all_rules = result.scalars().all()

    rules_index: dict[str, dict[str, PricingRule]] = {}
    for rule in all_rules:
        rules_index.setdefault(rule.field_code, {})[rule.field_value] = rule

    price_total = Decimal("0")
    cost_total = Decimal("0")

    for field_code, field_value in config.values.items():
        if field_code in rules_index:
            rule = rules_index[field_code].get(str(field_value))
            if rule:
                price_total += rule.price_component
                cost_total += rule.cost_component

    config.price_estimate = price_total
    config.cost_price = cost_total


# ─── Configurations ───────────────────────────────────────────────────────────

async def get_configurations(
    db: AsyncSession,
    *,
    order_id: uuid.UUID | None = None,
    status: ConfigurationStatus | None = None,
    door_type: DoorType | None = None,
    is_template: bool | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[DoorConfiguration]:
    q = (
        select(DoorConfiguration)
        .options(selectinload(DoorConfiguration.markings))
        .order_by(DoorConfiguration.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if order_id is not None:
        q = q.where(DoorConfiguration.order_id == order_id)
    if status is not None:
        q = q.where(DoorConfiguration.status == status)
    if door_type is not None:
        q = q.where(DoorConfiguration.door_type == door_type)
    if is_template is not None:
        q = q.where(DoorConfiguration.is_template == is_template)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_configuration(db: AsyncSession, config_id: uuid.UUID) -> DoorConfiguration:
    result = await db.execute(
        select(DoorConfiguration)
        .options(selectinload(DoorConfiguration.markings))
        .where(DoorConfiguration.id == config_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Конфигурация {config_id} не найдена")
    return obj


async def create_configuration(
    db: AsyncSession, data: DoorConfigurationCreateSchema, created_by: uuid.UUID
) -> DoorConfiguration:
    obj = DoorConfiguration(
        door_type=data.door_type,
        name=data.name,
        quantity=data.quantity,
        values=data.values,
        is_template=data.is_template,
        notes=data.notes,
        order_id=data.order_id,
        created_by=created_by,
    )
    db.add(obj)
    await db.flush()

    if data.values:
        await _recalculate_prices(db, obj)

    await db.refresh(obj, ["markings"])
    return obj


async def update_configuration(
    db: AsyncSession, config_id: uuid.UUID, data: DoorConfigurationUpdateSchema
) -> DoorConfiguration:
    obj = await get_configuration(db, config_id)

    if data.name is not None:
        obj.name = data.name
    if data.quantity is not None:
        obj.quantity = data.quantity
    if data.values is not None:
        obj.values = data.values
    if data.status is not None:
        obj.status = data.status
    if data.notes is not None:
        obj.notes = data.notes

    if data.values is not None or data.quantity is not None:
        await _recalculate_prices(db, obj)

    await db.flush()
    await db.refresh(obj, ["markings"])
    return obj


async def duplicate_configuration(
    db: AsyncSession,
    config_id: uuid.UUID,
    created_by: uuid.UUID,
) -> DoorConfiguration:
    """Создаёт копию конфигурации: сброс статуса=draft, order_id=None, новое имя."""
    original = await get_configuration(db, config_id)
    new_config = DoorConfiguration(
        door_type=original.door_type,
        name=f"{original.name} (копия)",
        quantity=original.quantity,
        values=dict(original.values) if original.values else {},
        price_estimate=original.price_estimate,
        cost_price=original.cost_price,
        status=ConfigurationStatus.draft,
        order_id=None,
        notes=original.notes,
        created_by=created_by,
    )
    db.add(new_config)
    await db.flush()
    await db.refresh(new_config, ["markings"])
    return new_config


async def delete_configuration(db: AsyncSession, config_id: uuid.UUID) -> None:
    obj = await get_configuration(db, config_id)
    if obj.status != ConfigurationStatus.draft:
        raise BadRequestException("Удалить можно только конфигурацию в статусе 'draft'")
    await db.delete(obj)


# ─── Markings ─────────────────────────────────────────────────────────────────

async def get_markings(
    db: AsyncSession, config_id: uuid.UUID
) -> list[DoorMarking]:
    await get_configuration(db, config_id)
    result = await db.execute(
        select(DoorMarking)
        .where(DoorMarking.configuration_id == config_id)
        .order_by(DoorMarking.marking)
    )
    return list(result.scalars().all())


async def create_marking(
    db: AsyncSession, config_id: uuid.UUID, data: DoorMarkingCreateSchema
) -> DoorMarking:
    await get_configuration(db, config_id)
    existing = await db.execute(
        select(DoorMarking).where(
            DoorMarking.configuration_id == config_id,
            DoorMarking.marking == data.marking,
        )
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Маркировка '{data.marking}' уже существует в этой конфигурации")

    obj = DoorMarking(configuration_id=config_id, **data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def update_marking(
    db: AsyncSession, marking_id: uuid.UUID, data: DoorMarkingUpdateSchema
) -> DoorMarking:
    result = await db.execute(
        select(DoorMarking).where(DoorMarking.id == marking_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Маркировка {marking_id} не найдена")

    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(obj, k, v)

    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_marking(db: AsyncSession, marking_id: uuid.UUID) -> None:
    result = await db.execute(
        select(DoorMarking).where(DoorMarking.id == marking_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Маркировка {marking_id} не найдена")
    await db.delete(obj)


async def generate_markings(
    db: AsyncSession, config_id: uuid.UUID, data: GenerateMarkingsSchema
) -> list[DoorMarking]:
    """Автоматически генерирует маркировки (Д3-001, Д3-002, ...) для конфигурации."""
    await get_configuration(db, config_id)

    existing_result = await db.execute(
        select(DoorMarking.marking).where(DoorMarking.configuration_id == config_id)
    )
    existing_markings = {row[0] for row in existing_result.all()}

    new_markings: list[DoorMarking] = []
    for i in range(data.count):
        number = data.start_number + i
        marking_str = f"{data.prefix}-{str(number).zfill(data.zero_pad)}"
        if marking_str in existing_markings:
            continue
        obj = DoorMarking(configuration_id=config_id, marking=marking_str)
        db.add(obj)
        new_markings.append(obj)

    await db.flush()
    for obj in new_markings:
        await db.refresh(obj)

    return new_markings


async def bulk_import_markings(
    db: AsyncSession, config_id: uuid.UUID, data: BulkMarkingsImportSchema
) -> list[DoorMarking]:
    """Массовый импорт маркировок из списка (напр. из спецификации застройщика)."""
    await get_configuration(db, config_id)

    existing_result = await db.execute(
        select(DoorMarking.marking).where(DoorMarking.configuration_id == config_id)
    )
    existing_markings = {row[0] for row in existing_result.all()}

    new_markings: list[DoorMarking] = []
    for row in data.markings:
        if row.marking in existing_markings:
            continue
        obj = DoorMarking(
            configuration_id=config_id,
            marking=row.marking,
            floor=row.floor,
            building_block=row.building_block,
            apartment_number=row.apartment_number,
            location_description=row.location_description,
        )
        db.add(obj)
        new_markings.append(obj)
        existing_markings.add(row.marking)

    await db.flush()
    for obj in new_markings:
        await db.refresh(obj)

    return new_markings


async def clear_markings(db: AsyncSession, config_id: uuid.UUID) -> int:
    """Удаляет все маркировки конфигурации. Возвращает количество удалённых."""
    await get_configuration(db, config_id)
    result = await db.execute(
        delete(DoorMarking).where(DoorMarking.configuration_id == config_id)
    )
    return result.rowcount
