"""Door stage movement — перемещение дверей между этапами производства."""
import uuid
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import BadRequestException, NotFoundException
from app.orders.models import DoorStatus, OrderDoor, OrderItem
from app.configurator.models import DoorConfiguration
from app.production.models import DoorStageHistory, ProductionRoute, ProductionStage

logger = logging.getLogger(__name__)


async def _get_door(db: AsyncSession, door_id: uuid.UUID) -> OrderDoor:
    result = await db.execute(
        select(OrderDoor).where(OrderDoor.id == door_id)
    )
    door = result.scalar_one_or_none()
    if not door:
        raise NotFoundException("Дверь не найдена")
    return door


async def _get_route_for_door(
    db: AsyncSession,
    door: OrderDoor,
) -> list[ProductionRoute]:
    """Get production route for a door via: door → item → configuration → door_model_id → routes."""
    # Get item → configuration → door_model_id
    item_result = await db.execute(
        select(OrderItem).where(OrderItem.id == door.order_item_id)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        return []

    config_result = await db.execute(
        select(DoorConfiguration).where(DoorConfiguration.id == item.configuration_id)
    )
    config = config_result.scalar_one_or_none()
    if not config or not config.door_model_id:
        return []

    route_result = await db.execute(
        select(ProductionRoute)
        .where(ProductionRoute.door_model_id == config.door_model_id)
        .options(selectinload(ProductionRoute.stage))
        .order_by(ProductionRoute.step_order)
    )
    return list(route_result.scalars().all())


async def _record_history(
    db: AsyncSession,
    door_id: uuid.UUID,
    from_stage_id: uuid.UUID | None,
    to_stage_id: uuid.UUID,
    user_id: uuid.UUID,
    notes: str | None = None,
) -> DoorStageHistory:
    entry = DoorStageHistory(
        door_id=door_id,
        from_stage_id=from_stage_id,
        to_stage_id=to_stage_id,
        moved_by=user_id,
        notes=notes,
    )
    db.add(entry)
    return entry


async def initialize_door_production(
    db: AsyncSession,
    door_id: uuid.UUID,
    user_id: uuid.UUID,
) -> OrderDoor:
    """Called when door enters in_production. Sets current_stage_id to first route step."""
    door = await _get_door(db, door_id)
    route = await _get_route_for_door(db, door)

    if not route:
        logger.info(f"Door {door_id}: no production route defined, skipping stage init")
        return door

    first_stage_id = route[0].stage_id
    door.current_stage_id = first_stage_id

    await _record_history(db, door_id, None, first_stage_id, user_id)
    await db.flush()
    return door


async def move_door_to_next_stage(
    db: AsyncSession,
    door_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    notes: str | None = None,
) -> OrderDoor:
    """Advance door to next stage. Auto-complete to ready_for_shipment if last stage."""
    door = await _get_door(db, door_id)

    if door.status != DoorStatus.in_production:
        raise BadRequestException("Дверь не в производстве")

    route = await _get_route_for_door(db, door)
    if not route:
        raise BadRequestException("Маршрут не настроен для модели этой двери")

    if not door.current_stage_id:
        raise BadRequestException("У двери не установлен текущий этап")

    # Find current position
    current_idx = None
    for i, step in enumerate(route):
        if step.stage_id == door.current_stage_id:
            current_idx = i
            break

    if current_idx is None:
        raise BadRequestException("Текущий этап не найден в маршруте")

    from_stage_id = door.current_stage_id

    if current_idx + 1 < len(route):
        # Move to next stage
        next_stage_id = route[current_idx + 1].stage_id
        door.current_stage_id = next_stage_id
        await _record_history(db, door_id, from_stage_id, next_stage_id, user_id, notes)
    else:
        # Last stage completed → auto-transition to ready_for_shipment
        door.status = DoorStatus.ready_for_shipment
        door.current_stage_id = None
        # Record history with last stage
        await _record_history(db, door_id, from_stage_id, route[-1].stage_id, user_id,
                              notes or "Последний этап завершён → готова к отгрузке")
        logger.info(f"Door {door_id}: completed last stage, auto-transitioned to ready_for_shipment")

    await db.flush()
    return door


async def move_door_to_prev_stage(
    db: AsyncSession,
    door_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    notes: str | None = None,
) -> OrderDoor:
    """Move door back to previous stage."""
    door = await _get_door(db, door_id)

    if door.status != DoorStatus.in_production:
        raise BadRequestException("Дверь не в производстве")

    route = await _get_route_for_door(db, door)
    if not route:
        raise BadRequestException("Маршрут не настроен для модели этой двери")

    if not door.current_stage_id:
        raise BadRequestException("У двери не установлен текущий этап")

    current_idx = None
    for i, step in enumerate(route):
        if step.stage_id == door.current_stage_id:
            current_idx = i
            break

    if current_idx is None:
        raise BadRequestException("Текущий этап не найден в маршруте")

    if current_idx == 0:
        raise BadRequestException("Дверь уже на первом этапе маршрута")

    from_stage_id = door.current_stage_id
    prev_stage_id = route[current_idx - 1].stage_id
    door.current_stage_id = prev_stage_id

    await _record_history(db, door_id, from_stage_id, prev_stage_id, user_id, notes)
    await db.flush()
    return door


async def move_door_to_stage(
    db: AsyncSession,
    door_id: uuid.UUID,
    stage_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    notes: str | None = None,
) -> OrderDoor:
    """Move door to a specific stage (must be in its route)."""
    door = await _get_door(db, door_id)

    if door.status != DoorStatus.in_production:
        raise BadRequestException("Дверь не в производстве")

    route = await _get_route_for_door(db, door)
    if not route:
        raise BadRequestException("Маршрут не настроен для модели этой двери")

    # Validate target stage is in route
    valid_stage_ids = {step.stage_id for step in route}
    if stage_id not in valid_stage_ids:
        raise BadRequestException("Указанный этап не входит в маршрут этой модели")

    from_stage_id = door.current_stage_id
    door.current_stage_id = stage_id

    await _record_history(db, door_id, from_stage_id, stage_id, user_id, notes)
    await db.flush()
    return door


async def get_door_history(
    db: AsyncSession,
    door_id: uuid.UUID,
) -> list[DoorStageHistory]:
    """Get stage transition history for a door."""
    result = await db.execute(
        select(DoorStageHistory)
        .where(DoorStageHistory.door_id == door_id)
        .options(
            selectinload(DoorStageHistory.from_stage),
            selectinload(DoorStageHistory.to_stage),
        )
        .order_by(DoorStageHistory.moved_at)
    )
    return list(result.scalars().all())
