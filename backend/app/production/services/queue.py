import uuid
from collections import defaultdict

from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.configurator.models import DoorConfiguration
from app.orders.models import DoorStatus, Order, OrderDoor, OrderItem
from app.production.models import (
    DoorWorkshopProgress,
    ProductionRoute,
    ProductionStage,
    ProductionWorkshop,
)
from app.production.schemas import (
    ProductionDoorSchema,
    ProductionQueueResponse,
    StageCounterSchema,
    WorkshopCounterSchema,
    WorkshopProgressSchema,
)


async def get_production_queue(
    db: AsyncSession,
    *,
    stage_id: uuid.UUID | None = None,
    workshop_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
    door_model_id: uuid.UUID | None = None,
    priority: bool | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ProductionQueueResponse:
    """Get paginated production queue with workshop progress."""
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

    if workshop_id is not None:
        door_ids_in_ws = (
            select(DoorWorkshopProgress.door_id)
            .where(
                DoorWorkshopProgress.workshop_id == workshop_id,
                DoorWorkshopProgress.status == "active",
            )
        )
        base = base.where(OrderDoor.id.in_(door_ids_in_ws))

    if stage_id is not None:
        door_ids_at_stage = (
            select(DoorWorkshopProgress.door_id)
            .where(
                DoorWorkshopProgress.current_stage_id == stage_id,
                DoorWorkshopProgress.status == "active",
            )
        )
        base = base.where(
            or_(
                OrderDoor.id.in_(door_ids_at_stage),
                OrderDoor.current_stage_id == stage_id,
            )
        )

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

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar_one()

    rows = (
        await db.execute(
            base.order_by(OrderDoor.priority.desc(), OrderDoor.created_at)
            .limit(limit)
            .offset(offset)
        )
    ).all()

    items: list[ProductionDoorSchema] = []
    for row in rows:
        door_model_label = None
        route_total = 0
        route_current = 0

        if row.door_model_id:
            from app.configurator.models import DoorModel
            model_result = await db.execute(
                select(DoorModel.label).where(DoorModel.id == row.door_model_id)
            )
            door_model_label = model_result.scalar_one_or_none()

            rc = await db.execute(
                select(func.count(ProductionRoute.id))
                .where(ProductionRoute.door_model_id == row.door_model_id)
            )
            route_total = rc.scalar_one() or 0

        # Workshop progress
        progress_result = await db.execute(
            select(DoorWorkshopProgress)
            .where(DoorWorkshopProgress.door_id == row.door_id)
            .options(
                selectinload(DoorWorkshopProgress.workshop),
                selectinload(DoorWorkshopProgress.current_stage),
            )
            .order_by(DoorWorkshopProgress.phase, DoorWorkshopProgress.workshop_id)
        )
        progress_entries = list(progress_result.scalars().all())

        workshop_progress: list[WorkshopProgressSchema] = []
        current_phase = None
        total_phases = 0

        if progress_entries:
            total_phases = len({p.phase for p in progress_entries})
            active_entries = [p for p in progress_entries if p.status == "active"]
            if active_entries:
                current_phase = active_entries[0].phase

            for pe in progress_entries:
                track_total = 0
                track_current = 0
                if row.door_model_id and pe.workshop_id:
                    tr = await db.execute(
                        select(ProductionRoute)
                        .where(
                            ProductionRoute.door_model_id == row.door_model_id,
                            ProductionRoute.phase == pe.phase,
                            ProductionRoute.workshop_id == pe.workshop_id,
                        )
                        .order_by(ProductionRoute.step_order)
                    )
                    track_steps = list(tr.scalars().all())
                    track_total = len(track_steps)
                    if pe.current_stage_id:
                        for i, s in enumerate(track_steps):
                            if s.stage_id == pe.current_stage_id:
                                track_current = i + 1
                                break
                    elif pe.status == "completed":
                        track_current = track_total

                workshop_progress.append(WorkshopProgressSchema(
                    workshop_id=pe.workshop_id,
                    workshop_name=pe.workshop.name if pe.workshop else "",
                    workshop_code=pe.workshop.code if pe.workshop else "",
                    workshop_color=pe.workshop.color if pe.workshop else None,
                    phase=pe.phase,
                    current_stage_id=pe.current_stage_id,
                    current_stage_name=pe.current_stage.name if pe.current_stage else None,
                    current_stage_code=pe.current_stage.code if pe.current_stage else None,
                    status=pe.status,
                    track_total_steps=track_total,
                    track_current_step=track_current,
                ))
        else:
            # Legacy: no progress entries
            if row.current_stage_id and row.door_model_id:
                rr = await db.execute(
                    select(ProductionRoute)
                    .where(ProductionRoute.door_model_id == row.door_model_id)
                    .order_by(ProductionRoute.step_order)
                )
                for i, step in enumerate(rr.scalars().all()):
                    route_total = i + 1
                    if step.stage_id == row.current_stage_id:
                        route_current = i + 1

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
            current_phase=current_phase,
            total_phases=total_phases,
            workshop_progress=workshop_progress,
        ))

    counters = await get_stage_counters(db)
    workshop_counters = await get_workshop_counters(db)

    return ProductionQueueResponse(
        items=items,
        total=total,
        counters=counters,
        workshop_counters=workshop_counters,
    )


async def get_stage_counters(db: AsyncSession) -> list[StageCounterSchema]:
    """Count doors per stage using workshop progress."""
    ws_map: dict[uuid.UUID, ProductionWorkshop] = {}
    ws_result = await db.execute(select(ProductionWorkshop))
    for ws in ws_result.scalars().all():
        ws_map[ws.id] = ws

    result = await db.execute(
        select(
            ProductionStage.id.label("stage_id"),
            ProductionStage.name.label("stage_name"),
            ProductionStage.code.label("stage_code"),
            ProductionStage.workshop_id,
            func.count(DoorWorkshopProgress.id).label("count"),
        )
        .outerjoin(
            DoorWorkshopProgress,
            (DoorWorkshopProgress.current_stage_id == ProductionStage.id)
            & (DoorWorkshopProgress.status == "active"),
        )
        .where(ProductionStage.is_active.is_(True))
        .group_by(
            ProductionStage.id, ProductionStage.name,
            ProductionStage.code, ProductionStage.workshop_id,
        )
        .order_by(ProductionStage.sort_order)
    )

    counters = []
    for row in result.all():
        ws = ws_map.get(row.workshop_id) if row.workshop_id else None
        counters.append(StageCounterSchema(
            stage_id=row.stage_id,
            stage_name=row.stage_name,
            stage_code=row.stage_code,
            count=row.count,
            workshop_id=row.workshop_id,
            workshop_name=ws.name if ws else None,
            workshop_code=ws.code if ws else None,
            workshop_color=ws.color if ws else None,
        ))

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


async def get_workshop_counters(db: AsyncSession) -> list[WorkshopCounterSchema]:
    """Count active doors per workshop."""
    result = await db.execute(
        select(
            ProductionWorkshop.id.label("workshop_id"),
            ProductionWorkshop.name.label("workshop_name"),
            ProductionWorkshop.code.label("workshop_code"),
            ProductionWorkshop.color.label("workshop_color"),
            func.count(DoorWorkshopProgress.id).label("count"),
        )
        .outerjoin(
            DoorWorkshopProgress,
            (DoorWorkshopProgress.workshop_id == ProductionWorkshop.id)
            & (DoorWorkshopProgress.status == "active"),
        )
        .where(ProductionWorkshop.is_active.is_(True))
        .group_by(
            ProductionWorkshop.id, ProductionWorkshop.name,
            ProductionWorkshop.code, ProductionWorkshop.color,
        )
        .order_by(ProductionWorkshop.sort_order)
    )

    return [
        WorkshopCounterSchema(
            workshop_id=row.workshop_id,
            workshop_name=row.workshop_name,
            workshop_code=row.workshop_code,
            workshop_color=row.workshop_color,
            count=row.count,
        )
        for row in result.all()
    ]
