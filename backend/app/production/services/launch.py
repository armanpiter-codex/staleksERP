"""Launch service — управление запуском дверей в производство (Sprint 17).

Функциональность:
- CRUD для launch_check_definitions (пункты чеклиста)
- Получение/обновление статуса пунктов для конкретной двери
- Список pending дверей готовых к запуску
- Batch-запуск: pending → in_production (делегирует movement.initialize_door_production)
"""
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import BadRequestException, NotFoundException
from app.configurator.models import DoorConfiguration, DoorModel
from app.orders.models import DoorStatus, Order, OrderDoor, OrderItem, OrderStatus
from app.production.models import DoorLaunchCheck, LaunchCheckDefinition
from app.production.schemas import (
    BatchLaunchSchema,
    DoorLaunchCheckSchema,
    DoorLaunchCheckUpdateSchema,
    LaunchCheckDefinitionCreateSchema,
    LaunchCheckDefinitionUpdateSchema,
    PendingDoorCheckStatusSchema,
    PendingDoorSchema,
    ReorderLaunchChecksSchema,
)


# ─── Check Definitions CRUD ───────────────────────────────────────────────────

async def list_check_definitions(
    db: AsyncSession,
    include_inactive: bool = False,
) -> list[LaunchCheckDefinition]:
    q = select(LaunchCheckDefinition).order_by(LaunchCheckDefinition.sort_order)
    if not include_inactive:
        q = q.where(LaunchCheckDefinition.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_check_definition(
    db: AsyncSession,
    check_id: uuid.UUID,
) -> LaunchCheckDefinition:
    result = await db.execute(
        select(LaunchCheckDefinition).where(LaunchCheckDefinition.id == check_id)
    )
    check = result.scalar_one_or_none()
    if not check:
        raise NotFoundException("Пункт чеклиста не найден")
    return check


async def create_check_definition(
    db: AsyncSession,
    data: LaunchCheckDefinitionCreateSchema,
) -> LaunchCheckDefinition:
    # Validate unique code
    existing = await db.execute(
        select(LaunchCheckDefinition).where(LaunchCheckDefinition.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise BadRequestException(f"Код '{data.code}' уже занят")

    check = LaunchCheckDefinition(
        code=data.code,
        name=data.name,
        description=data.description,
        is_required=data.is_required,
        sort_order=data.sort_order,
        is_active=data.is_active,
    )
    db.add(check)
    await db.commit()
    await db.refresh(check)
    return check


async def update_check_definition(
    db: AsyncSession,
    check_id: uuid.UUID,
    data: LaunchCheckDefinitionUpdateSchema,
) -> LaunchCheckDefinition:
    check = await get_check_definition(db, check_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(check, field, value)
    await db.commit()
    await db.refresh(check)
    return check


async def reorder_check_definitions(
    db: AsyncSession,
    data: ReorderLaunchChecksSchema,
) -> list[LaunchCheckDefinition]:
    for idx, check_id in enumerate(data.check_ids):
        result = await db.execute(
            select(LaunchCheckDefinition).where(LaunchCheckDefinition.id == check_id)
        )
        check = result.scalar_one_or_none()
        if check:
            check.sort_order = (idx + 1) * 10
    await db.commit()
    return await list_check_definitions(db)


# ─── Door Launch Checks ───────────────────────────────────────────────────────

async def get_door_launch_checks(
    db: AsyncSession,
    door_id: uuid.UUID,
) -> list[DoorLaunchCheckSchema]:
    """Возвращает список всех активных пунктов чеклиста с их статусом для двери."""
    # Get all active check definitions
    defs_result = await db.execute(
        select(LaunchCheckDefinition)
        .where(LaunchCheckDefinition.is_active.is_(True))
        .order_by(LaunchCheckDefinition.sort_order)
    )
    all_defs = list(defs_result.scalars().all())

    # Get existing door check records
    checks_result = await db.execute(
        select(DoorLaunchCheck)
        .where(DoorLaunchCheck.door_id == door_id)
        .options(selectinload(DoorLaunchCheck.check_def))
    )
    existing = {c.check_id: c for c in checks_result.scalars().all()}

    # Build response — create missing records lazily
    result = []
    for check_def in all_defs:
        if check_def.id in existing:
            check = existing[check_def.id]
        else:
            # Create a new record (not done yet)
            check = DoorLaunchCheck(
                door_id=door_id,
                check_id=check_def.id,
                is_done=False,
            )
            db.add(check)
            check.check_def = check_def  # attach for schema building

        result.append(DoorLaunchCheckSchema(
            id=check.id if check.id else uuid.uuid4(),  # temp uuid before flush
            door_id=door_id,
            check_id=check_def.id,
            check_name=check_def.name,
            check_description=check_def.description,
            is_required=check_def.is_required,
            sort_order=check_def.sort_order,
            is_done=check.is_done,
            done_by=check.done_by,
            done_at=check.done_at,
            notes=check.notes,
        ))

    await db.commit()

    # Re-fetch to get real IDs
    checks_result2 = await db.execute(
        select(DoorLaunchCheck)
        .where(DoorLaunchCheck.door_id == door_id)
        .options(selectinload(DoorLaunchCheck.check_def))
        .order_by(DoorLaunchCheck.check_id)
    )
    checks_by_def = {c.check_id: c for c in checks_result2.scalars().all()}

    final = []
    for check_def in all_defs:
        check = checks_by_def.get(check_def.id)
        if not check:
            continue
        final.append(DoorLaunchCheckSchema(
            id=check.id,
            door_id=door_id,
            check_id=check_def.id,
            check_name=check_def.name,
            check_description=check_def.description,
            is_required=check_def.is_required,
            sort_order=check_def.sort_order,
            is_done=check.is_done,
            done_by=check.done_by,
            done_at=check.done_at,
            notes=check.notes,
        ))
    return final


async def update_door_launch_check(
    db: AsyncSession,
    door_id: uuid.UUID,
    check_id: uuid.UUID,
    data: DoorLaunchCheckUpdateSchema,
    user_id: uuid.UUID,
) -> DoorLaunchCheckSchema:
    """Отметить пункт чеклиста выполненным/невыполненным."""
    # Ensure check def exists
    check_def = await get_check_definition(db, check_id)

    # Get or create door check record
    result = await db.execute(
        select(DoorLaunchCheck).where(
            DoorLaunchCheck.door_id == door_id,
            DoorLaunchCheck.check_id == check_id,
        )
    )
    check = result.scalar_one_or_none()

    if not check:
        check = DoorLaunchCheck(
            door_id=door_id,
            check_id=check_id,
            is_done=False,
        )
        db.add(check)

    check.is_done = data.is_done
    check.notes = data.notes
    if data.is_done:
        check.done_by = user_id
        check.done_at = datetime.now(timezone.utc)
    else:
        check.done_by = None
        check.done_at = None

    await db.commit()
    await db.refresh(check)

    return DoorLaunchCheckSchema(
        id=check.id,
        door_id=door_id,
        check_id=check_def.id,
        check_name=check_def.name,
        check_description=check_def.description,
        is_required=check_def.is_required,
        sort_order=check_def.sort_order,
        is_done=check.is_done,
        done_by=check.done_by,
        done_at=check.done_at,
        notes=check.notes,
    )


# ─── Pending Doors ───────────────────────────────────────────────────────────

async def get_pending_doors(
    db: AsyncSession,
    *,
    check_ids: list[uuid.UUID] | None = None,
    priority_filter: bool | None = None,
    search: str | None = None,
) -> list[PendingDoorSchema]:
    """Список pending дверей из заказов со статусом contract_signed или выше.

    Filters:
    - check_ids: only doors where ALL specified checks have is_done=True
    - priority_filter: if True, only priority doors
    - search: ILIKE on internal_number, marking, order_number, client_name
    """
    # Base query
    query = (
        select(OrderDoor)
        .join(OrderItem, OrderDoor.order_item_id == OrderItem.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(
            OrderDoor.status == DoorStatus.pending,
            Order.status.in_([
                OrderStatus.contract_signed,
                OrderStatus.active,
            ]),
        )
        .options(
            selectinload(OrderDoor.order_item).selectinload(OrderItem.order).selectinload(Order.facility),
            selectinload(OrderDoor.order_item).selectinload(OrderItem.configuration),
        )
        .order_by(OrderDoor.priority.desc(), OrderDoor.internal_number)
    )

    # Filter: priority
    if priority_filter is True:
        query = query.where(OrderDoor.priority.is_(True))

    # Filter: search
    if search:
        pattern = f"%{search}%"
        query = query.where(
            sa.or_(
                OrderDoor.internal_number.ilike(pattern),
                OrderDoor.marking.ilike(pattern),
                Order.order_number.ilike(pattern),
                Order.client_name.ilike(pattern),
            )
        )

    # Filter: check_ids — only doors where ALL specified checks are done
    if check_ids:
        done_subq = (
            select(DoorLaunchCheck.door_id)
            .where(
                DoorLaunchCheck.check_id.in_(check_ids),
                DoorLaunchCheck.is_done.is_(True),
            )
            .group_by(DoorLaunchCheck.door_id)
            .having(func.count(DoorLaunchCheck.id) == len(check_ids))
        ).subquery()
        query = query.where(OrderDoor.id.in_(select(done_subq.c.door_id)))

    result = await db.execute(query)
    doors = list(result.scalars().all())

    if not doors:
        return []

    door_ids = [d.id for d in doors]

    # Get all model labels in batch
    model_ids = set()
    for door in doors:
        item = door.order_item
        if item and item.configuration and item.configuration.door_model_id:
            model_ids.add(item.configuration.door_model_id)

    model_labels: dict[uuid.UUID, str] = {}
    if model_ids:
        models_result = await db.execute(
            select(DoorModel).where(DoorModel.id.in_(list(model_ids)))
        )
        for m in models_result.scalars().all():
            model_labels[m.id] = m.label

    # Get all active check definitions
    defs_result = await db.execute(
        select(LaunchCheckDefinition)
        .where(LaunchCheckDefinition.is_active.is_(True))
        .order_by(LaunchCheckDefinition.sort_order)
    )
    active_defs = list(defs_result.scalars().all())
    total_defs = len(active_defs)

    # Required check defs count
    required_defs = sum(1 for d in active_defs if d.is_required)

    # Get all door_launch_checks for these doors in one query
    all_checks_result = await db.execute(
        select(DoorLaunchCheck)
        .where(DoorLaunchCheck.door_id.in_(door_ids))
    )
    all_checks = list(all_checks_result.scalars().all())

    # Build lookup: door_id -> {check_id -> is_done}
    checks_by_door: dict[uuid.UUID, dict[uuid.UUID, bool]] = {}
    for c in all_checks:
        checks_by_door.setdefault(c.door_id, {})[c.check_id] = c.is_done

    result_list = []
    for door in doors:
        item = door.order_item
        if not item:
            continue
        order = item.order
        config = item.configuration

        door_model_id = config.door_model_id if config else None
        door_model_label = model_labels.get(door_model_id) if door_model_id else None

        door_checks = checks_by_door.get(door.id, {})
        done_checks = sum(1 for v in door_checks.values() if v)
        req_done = sum(
            1 for d in active_defs
            if d.is_required and door_checks.get(d.id, False)
        )
        is_ready = (required_defs == 0) or (req_done >= required_defs)

        # Build check_statuses for this door
        check_statuses = [
            PendingDoorCheckStatusSchema(
                check_id=cd.id,
                check_code=cd.code,
                check_name=cd.name,
                is_done=door_checks.get(cd.id, False),
            )
            for cd in active_defs
        ]

        result_list.append(PendingDoorSchema(
            id=door.id,
            internal_number=door.internal_number,
            marking=door.marking,
            order_id=order.id,
            order_number=order.order_number,
            item_id=item.id,
            door_model_id=door_model_id,
            door_model_label=door_model_label,
            client_name=order.client_name,
            facility_name=order.facility.name if order.facility else None,
            floor=door.floor,
            building_block=door.building_block,
            apartment=door.apartment_number,
            priority=door.priority,
            checks_total=int(total_defs),
            checks_done=done_checks,
            is_ready=is_ready,
            check_statuses=check_statuses,
        ))

    return result_list


# ─── Batch Launch ─────────────────────────────────────────────────────────────

async def batch_launch_doors(
    db: AsyncSession,
    data: BatchLaunchSchema,
    user_id: uuid.UUID,
) -> dict:
    """Запустить несколько дверей в производство (pending → in_production)."""
    from app.production.services.movement import initialize_door_production

    launched = []
    errors = []

    for door_id in data.door_ids:
        try:
            result = await db.execute(
                select(OrderDoor)
                .where(OrderDoor.id == door_id)
                .options(
                    selectinload(OrderDoor.order_item).selectinload(OrderItem.order)
                )
            )
            door = result.scalar_one_or_none()
            if not door:
                errors.append({"door_id": str(door_id), "error": "Дверь не найдена"})
                continue

            if door.status != DoorStatus.pending:
                errors.append({
                    "door_id": str(door_id),
                    "internal_number": door.internal_number,
                    "error": f"Статус не pending: {door.status.value}"
                })
                continue

            # Transition to in_production
            door.status = DoorStatus.in_production
            await db.flush()

            # Initialize production stages
            await initialize_door_production(db, door_id, user_id)

            # Auto-activate order if needed
            item = door.order_item
            if item and item.order:
                order = item.order
                if order.status not in (
                    OrderStatus.active, OrderStatus.completed, OrderStatus.cancelled
                ):
                    order.status = OrderStatus.active
                    order.confirmed_at = order.confirmed_at or datetime.now(timezone.utc)
                    await db.flush()

            launched.append({
                "door_id": str(door_id),
                "internal_number": door.internal_number,
            })
        except Exception as e:
            await db.rollback()
            errors.append({
                "door_id": str(door_id),
                "error": str(e),
            })

    if launched:
        await db.commit()
    return {
        "launched": launched,
        "errors": errors,
        "total_launched": len(launched),
        "total_errors": len(errors),
    }
