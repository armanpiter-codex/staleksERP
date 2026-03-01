"""Doors — генерация и управление физическими дверьми (OrderDoor)."""
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.orders.models import DoorStatus, Order, OrderDoor, OrderItem, OrderItemStatus
from app.orders.schemas import ApplyMarkingsSchema, BatchDoorStatusSchema, GenerateDoorsSchema, OrderDoorUpdateSchema
from app.orders.services.crud import _find_item, get_order


# ─── Constants ────────────────────────────────────────────────────────────────

ALLOWED_DOOR_TRANSITIONS: dict[DoorStatus, list[DoorStatus]] = {
    DoorStatus.pending: [DoorStatus.in_production],
    DoorStatus.in_production: [DoorStatus.ready_for_shipment],
    DoorStatus.ready_for_shipment: [DoorStatus.shipped],
    DoorStatus.shipped: [DoorStatus.completed],
    DoorStatus.completed: [],
}

DOOR_TRANSITION_PERMISSIONS: dict[DoorStatus, str] = {
    DoorStatus.in_production:      "doors:transition_to_in_production",
    DoorStatus.ready_for_shipment: "doors:transition_to_ready",
    DoorStatus.shipped:            "doors:transition_to_shipped",
    DoorStatus.completed:          "doors:transition_to_completed",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _find_door_in_order(order: Order, door_id: uuid.UUID) -> OrderDoor:
    for item in order.items:
        for door in (item.doors or []):
            if door.id == door_id:
                return door
    raise NotFoundException(f"Дверь {door_id} не найдена в заказе {order.id}")


def _check_door_transition_permission(
    target_status: DoorStatus,
    user_permissions: list[str],
) -> None:
    """Проверка granular permission (Sprint 3). owner/admin с orders:write — bypass."""
    if "orders:write" in user_permissions:
        return
    required = DOOR_TRANSITION_PERMISSIONS.get(target_status)
    if required and required not in user_permissions:
        raise ForbiddenException(
            f"Нет прав для перевода двери в статус '{target_status.value}'. "
            f"Требуется: {required}"
        )


async def _generate_internal_number(db: AsyncSession) -> str:
    result = await db.execute(text("SELECT nextval('door_internal_seq')"))
    seq_val = result.scalar_one()
    return f"D-{seq_val:05d}"


async def _generate_doors_for_item(
    db: AsyncSession,
    item: OrderItem,
    marking_prefix: str | None = None,
    start_number: int = 1,
    floor: str | None = None,
    building_block: str | None = None,
    apartment_number: str | None = None,
) -> list[OrderDoor]:
    """Автоматически создаёт OrderDoor записи для позиции."""
    created = []
    for i in range(item.quantity):
        internal_number = await _generate_internal_number(db)
        marking = f"{marking_prefix}-{start_number + i:03d}" if marking_prefix else None
        door = OrderDoor(
            order_item_id=item.id,
            internal_number=internal_number,
            marking=marking,
            floor=floor,
            building_block=building_block,
            apartment_number=apartment_number,
            status=DoorStatus.pending,
            priority=item.priority,
        )
        db.add(door)
        created.append(door)
    await db.flush()
    return created


# ─── Door operations ──────────────────────────────────────────────────────────

async def generate_doors(
    db: AsyncSession,
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: GenerateDoorsSchema,
) -> list[OrderDoor]:
    """Ручная генерация дверей через API."""
    order = await get_order(db, order_id)
    item = _find_item(order, item_id)

    if item.status in (OrderItemStatus.completed, OrderItemStatus.cancelled):
        raise BadRequestException(
            "Нельзя генерировать двери для завершённой/отменённой позиции"
        )

    count = data.count if data.count else item.quantity
    existing_doors = list(item.doors) if item.doors else []

    if len(existing_doors) + count > item.quantity:
        raise BadRequestException(
            f"Нельзя создать {count} дверей: уже есть {len(existing_doors)}, "
            f"лимит по позиции {item.quantity}"
        )

    created = []
    for i in range(count):
        internal_number = await _generate_internal_number(db)
        marking = f"{data.marking_prefix}-{data.start_number + i:03d}" if data.marking_prefix else None
        door = OrderDoor(
            order_item_id=item.id,
            internal_number=internal_number,
            marking=marking,
            floor=data.floor,
            building_block=data.building_block,
            apartment_number=data.apartment_number,
            status=DoorStatus.pending,
            priority=item.priority,
        )
        db.add(door)
        created.append(door)

    await db.flush()
    return created


async def update_door(
    db: AsyncSession,
    order_id: uuid.UUID,
    door_id: uuid.UUID,
    data: OrderDoorUpdateSchema,
) -> OrderDoor:
    order = await get_order(db, order_id)
    door = _find_door_in_order(order, door_id)
    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(door, k, v)
    await db.flush()
    return door


async def transition_door_status(
    db: AsyncSession,
    order_id: uuid.UUID,
    door_id: uuid.UUID,
    new_status: DoorStatus,
    user_permissions: list[str] | None = None,
    user_id: uuid.UUID | None = None,
) -> OrderDoor:
    order = await get_order(db, order_id)
    door = _find_door_in_order(order, door_id)

    allowed = ALLOWED_DOOR_TRANSITIONS.get(door.status, [])
    if new_status not in allowed:
        raise BadRequestException(
            f"Нельзя перейти из '{door.status.value}' в '{new_status.value}'"
        )

    if user_permissions is not None:
        _check_door_transition_permission(new_status, user_permissions)

    door.status = new_status

    # Sprint 13: initialize production stage when door enters in_production
    if new_status == DoorStatus.in_production and user_id:
        from app.production.services.movement import initialize_door_production
        await initialize_door_production(db, door.id, user_id)

    await db.flush()
    return door


async def batch_transition_door_status(
    db: AsyncSession,
    order_id: uuid.UUID,
    data: BatchDoorStatusSchema,
    user_permissions: list[str] | None = None,
) -> list[OrderDoor]:
    order = await get_order(db, order_id)

    if user_permissions is not None:
        _check_door_transition_permission(data.status, user_permissions)

    updated = []
    errors = []

    for door_id in data.door_ids:
        try:
            door = _find_door_in_order(order, door_id)
            allowed = ALLOWED_DOOR_TRANSITIONS.get(door.status, [])
            if data.status not in allowed:
                errors.append(
                    f"{door.internal_number}: нельзя из '{door.status.value}' в '{data.status.value}'"
                )
                continue
            door.status = data.status
            updated.append(door)
        except NotFoundException:
            errors.append(f"{door_id}: не найдена в заказе")

    if errors and not updated:
        raise BadRequestException("Ни одна дверь не обновлена: " + "; ".join(errors))

    await db.flush()
    return updated


async def toggle_door_priority(
    db: AsyncSession,
    order_id: uuid.UUID,
    door_id: uuid.UUID,
) -> OrderDoor:
    order = await get_order(db, order_id)
    door = _find_door_in_order(order, door_id)
    door.priority = not door.priority
    await db.flush()
    return door


async def delete_door(
    db: AsyncSession,
    order_id: uuid.UUID,
    door_id: uuid.UUID,
) -> None:
    order = await get_order(db, order_id)
    door = _find_door_in_order(order, door_id)
    if door.status != DoorStatus.pending:
        raise BadRequestException("Удалить можно только дверь в статусе 'pending'")
    await db.delete(door)
    await db.flush()


async def apply_markings(
    db: AsyncSession,
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ApplyMarkingsSchema,
) -> Order:
    """Применить маркировку ко всем дверям позиции (авто / вручную / очистить)."""
    order = await get_order(db, order_id)
    item = _find_item(order, item_id)

    # Загрузить двери позиции, упорядоченные по internal_number
    result = await db.execute(
        select(OrderDoor)
        .where(OrderDoor.order_item_id == item_id)
        .order_by(OrderDoor.internal_number)
    )
    doors = list(result.scalars().all())

    if not doors:
        raise BadRequestException("У позиции нет сгенерированных дверей")

    if data.marking_type == "none":
        for door in doors:
            door.marking = None

    elif data.marking_type == "auto":
        prefix = (data.prefix or "").strip()
        start = data.start_number or 1
        for i, door in enumerate(doors):
            door.marking = f"{prefix}{start + i}"

    elif data.marking_type == "manual":
        markings = data.markings or []
        for i, door in enumerate(doors):
            door.marking = markings[i] if i < len(markings) else None

    await db.flush()
    # Вернуть обновлённый заказ
    return await get_order(db, order_id)
