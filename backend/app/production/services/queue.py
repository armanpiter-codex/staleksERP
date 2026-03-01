import uuid

from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.configurator.models import DoorConfiguration
from app.orders.models import DoorStatus, Order, OrderDoor, OrderItem
from app.production.models import ProductionRoute, ProductionStage
from app.production.schemas import (
    ProductionDoorSchema,
    ProductionQueueResponse,
    StageCounterSchema,
)


async def get_production_queue(
    db: AsyncSession,
    *,
    stage_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
    door_model_id: uuid.UUID | None = None,
    priority: bool | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ProductionQueueResponse:
    """Get paginated production queue with enriched door info."""
    # Base query: doors in production
    base = (
        select(
            OrderDoor.id.label("door_id"),
            OrderDoor.internal_number,
            OrderDoor.marking,
            OrderDoor.priority,
            OrderDoor.current_stage_id,
            OrderDoor.notes,
            OrderDoor.created_at,
            OrderItem.id.label("item_id"),
            OrderItem.order_id,
            Order.order_number,
            DoorConfiguration.door_model_id,
            ProductionStage.name.label("current_stage_name"),
            ProductionStage.code.label("current_stage_code"),
        )
        .join(OrderItem, OrderDoor.order_item_id == OrderItem.id)
        .join(Order, OrderItem.order_id == Order.id)
        .join(DoorConfiguration, OrderItem.configuration_id == DoorConfiguration.id)
        .outerjoin(ProductionStage, OrderDoor.current_stage_id == ProductionStage.id)
        .where(OrderDoor.status == DoorStatus.in_production)
    )

    # Filters
    if stage_id is not None:
        base = base.where(OrderDoor.current_stage_id == stage_id)
    if order_id is not None:
        base = base.where(OrderItem.order_id == order_id)
    if door_model_id is not None:
        base = base.where(DoorConfiguration.door_model_id == door_model_id)
    if priority is not None:
        base = base.where(OrderDoor.priority == priority)
    if search:
        term = f"%{search}%"
        base = base.where(
            or_(
                OrderDoor.internal_number.ilike(term),
                OrderDoor.marking.ilike(term),
                Order.order_number.ilike(term),
            )
        )

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Paginated results
    rows = (
        await db.execute(
            base.order_by(OrderDoor.priority.desc(), OrderDoor.created_at)
            .limit(limit)
            .offset(offset)
        )
    ).all()

    # Build response items with route progress
    items: list[ProductionDoorSchema] = []
    for row in rows:
        # Get route info for progress tracking
        route_total = 0
        route_current = 0
        door_model_label = None

        if row.door_model_id:
            # Get model label
            from app.configurator.models import DoorModel
            model_result = await db.execute(
                select(DoorModel.label).where(DoorModel.id == row.door_model_id)
            )
            door_model_label = model_result.scalar_one_or_none()

            # Get route length and current position
            route_result = await db.execute(
                select(ProductionRoute)
                .where(ProductionRoute.door_model_id == row.door_model_id)
                .order_by(ProductionRoute.step_order)
            )
            route_steps = route_result.scalars().all()
            route_total = len(route_steps)
            if row.current_stage_id:
                for i, step in enumerate(route_steps):
                    if step.stage_id == row.current_stage_id:
                        route_current = i + 1
                        break

        items.append(ProductionDoorSchema(
            door_id=row.door_id,
            internal_number=row.internal_number,
            marking=row.marking,
            priority=row.priority,
            current_stage_id=row.current_stage_id,
            current_stage_name=row.current_stage_name,
            current_stage_code=row.current_stage_code,
            order_id=row.order_id,
            order_number=row.order_number,
            item_id=row.item_id,
            door_model_id=row.door_model_id,
            door_model_label=door_model_label,
            route_total_steps=route_total,
            route_current_step=route_current,
            notes=row.notes,
            created_at=row.created_at,
        ))

    # Get counters
    counters = await get_stage_counters(db)

    return ProductionQueueResponse(items=items, total=total, counters=counters)


async def get_stage_counters(db: AsyncSession) -> list[StageCounterSchema]:
    """Count doors in production per stage."""
    result = await db.execute(
        select(
            ProductionStage.id.label("stage_id"),
            ProductionStage.name.label("stage_name"),
            ProductionStage.code.label("stage_code"),
            func.count(OrderDoor.id).label("count"),
        )
        .outerjoin(
            OrderDoor,
            (OrderDoor.current_stage_id == ProductionStage.id)
            & (OrderDoor.status == DoorStatus.in_production),
        )
        .where(ProductionStage.is_active.is_(True))
        .group_by(ProductionStage.id, ProductionStage.name, ProductionStage.code)
        .order_by(ProductionStage.sort_order)
    )
    counters = [
        StageCounterSchema(
            stage_id=row.stage_id,
            stage_name=row.stage_name,
            stage_code=row.stage_code,
            count=row.count,
        )
        for row in result.all()
    ]

    # Add "no stage" counter for doors without current_stage_id
    no_stage_count = (
        await db.execute(
            select(func.count(OrderDoor.id)).where(
                OrderDoor.status == DoorStatus.in_production,
                OrderDoor.current_stage_id.is_(None),
            )
        )
    ).scalar_one()
    if no_stage_count > 0:
        counters.append(StageCounterSchema(
            stage_id=None,
            stage_name="Без этапа",
            stage_code="no_stage",
            count=no_stage_count,
        ))

    return counters
