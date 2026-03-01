import uuid

from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.auth.schemas import TokenPayload
from app.database import get_db
from app.production import services
from app.production.schemas import (
    DoorPrintDataSchema,
    DoorStageHistorySchema,
    MoveDoorStageSchema,
    MoveDoorToStageSchema,
    ProductionDoorSchema,
    ProductionQueueResponse,
    ProductionRouteSchema,
    ProductionStageCreateSchema,
    ProductionStageSchema,
    ProductionStageUpdateSchema,
    ReorderStagesSchema,
    RouteStepSchema,
    SetRouteSchema,
    StageCounterSchema,
    StagePrintDataSchema,
)

router = APIRouter(prefix="/production", tags=["Production"])


# ─── Stages CRUD ─────────────────────────────────────────────────────────────

@router.get("/stages", response_model=list[ProductionStageSchema])
async def list_stages(
    include_inactive: bool = Query(False),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[ProductionStageSchema]:
    stages = await services.list_stages(db, include_inactive=include_inactive)
    return [ProductionStageSchema.model_validate(s) for s in stages]


@router.post("/stages", response_model=ProductionStageSchema, status_code=201)
async def create_stage(
    data: ProductionStageCreateSchema,
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> ProductionStageSchema:
    stage = await services.create_stage(db, data)
    return ProductionStageSchema.model_validate(stage)


@router.patch("/stages/reorder", response_model=list[ProductionStageSchema])
async def reorder_stages(
    data: ReorderStagesSchema,
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> list[ProductionStageSchema]:
    stages = await services.reorder_stages(db, data.stage_ids)
    return [ProductionStageSchema.model_validate(s) for s in stages]


@router.patch("/stages/{stage_id}", response_model=ProductionStageSchema)
async def update_stage(
    data: ProductionStageUpdateSchema,
    stage_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> ProductionStageSchema:
    stage = await services.update_stage(db, stage_id, data)
    return ProductionStageSchema.model_validate(stage)


# ─── Routes per model ────────────────────────────────────────────────────────

@router.get("/routes", response_model=list[ProductionRouteSchema])
async def list_all_routes(
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[ProductionRouteSchema]:
    from app.configurator.models import DoorModel
    from sqlalchemy import select

    grouped = await services.get_all_routes(db)

    result = []
    for model_id, route_steps in grouped.items():
        model_result = await db.execute(
            select(DoorModel).where(DoorModel.id == model_id)
        )
        model = model_result.scalar_one_or_none()
        if not model:
            continue
        result.append(ProductionRouteSchema(
            door_model_id=model_id,
            door_model_code=model.code,
            door_model_label=model.label,
            steps=[
                RouteStepSchema(
                    id=step.id,
                    stage_id=step.stage_id,
                    stage_code=step.stage.code,
                    stage_name=step.stage.name,
                    step_order=step.step_order,
                    is_optional=step.is_optional,
                    notes=step.notes,
                )
                for step in route_steps
            ],
        ))
    return result


@router.get("/routes/{door_model_id}", response_model=ProductionRouteSchema)
async def get_route_for_model(
    door_model_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> ProductionRouteSchema:
    from app.configurator.models import DoorModel
    from app.common.exceptions import NotFoundException
    from sqlalchemy import select

    model_result = await db.execute(
        select(DoorModel).where(DoorModel.id == door_model_id)
    )
    model = model_result.scalar_one_or_none()
    if not model:
        raise NotFoundException("Модель двери не найдена")

    route_steps = await services.get_route_for_model(db, door_model_id)
    return ProductionRouteSchema(
        door_model_id=door_model_id,
        door_model_code=model.code,
        door_model_label=model.label,
        steps=[
            RouteStepSchema(
                id=step.id,
                stage_id=step.stage_id,
                stage_code=step.stage.code,
                stage_name=step.stage.name,
                step_order=step.step_order,
                is_optional=step.is_optional,
                notes=step.notes,
            )
            for step in route_steps
        ],
    )


@router.put("/routes/{door_model_id}", response_model=ProductionRouteSchema)
async def set_route_for_model(
    data: SetRouteSchema,
    door_model_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:routes")),
    db: AsyncSession = Depends(get_db),
) -> ProductionRouteSchema:
    from app.configurator.models import DoorModel
    from sqlalchemy import select

    route_steps = await services.set_route_for_model(db, door_model_id, data)

    model_result = await db.execute(
        select(DoorModel).where(DoorModel.id == door_model_id)
    )
    model = model_result.scalar_one()
    return ProductionRouteSchema(
        door_model_id=door_model_id,
        door_model_code=model.code,
        door_model_label=model.label,
        steps=[
            RouteStepSchema(
                id=step.id,
                stage_id=step.stage_id,
                stage_code=step.stage.code,
                stage_name=step.stage.name,
                step_order=step.step_order,
                is_optional=step.is_optional,
                notes=step.notes,
            )
            for step in route_steps
        ],
    )


# ─── Production Queue ────────────────────────────────────────────────────────

@router.get("/queue", response_model=ProductionQueueResponse)
async def get_production_queue(
    stage_id: uuid.UUID | None = Query(None),
    order_id: uuid.UUID | None = Query(None),
    door_model_id: uuid.UUID | None = Query(None),
    priority: bool | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> ProductionQueueResponse:
    return await services.get_production_queue(
        db,
        stage_id=stage_id,
        order_id=order_id,
        door_model_id=door_model_id,
        priority=priority,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/queue/counters", response_model=list[StageCounterSchema])
async def get_stage_counters(
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[StageCounterSchema]:
    return await services.get_stage_counters(db)


# ─── Door stage movement ────────────────────────────────────────────────────

@router.patch("/doors/{door_id}/move-next")
async def move_door_next(
    door_id: uuid.UUID = Path(...),
    data: MoveDoorStageSchema | None = None,
    current_user: TokenPayload = Depends(require_permission("production:move_door")),
    db: AsyncSession = Depends(get_db),
) -> ProductionDoorSchema:
    notes = data.notes if data else None
    door = await services.move_door_to_next_stage(
        db, door_id, uuid.UUID(current_user.sub), notes=notes,
    )
    return await _build_door_response(db, door)


@router.patch("/doors/{door_id}/move-prev")
async def move_door_prev(
    door_id: uuid.UUID = Path(...),
    data: MoveDoorStageSchema | None = None,
    current_user: TokenPayload = Depends(require_permission("production:move_door")),
    db: AsyncSession = Depends(get_db),
) -> ProductionDoorSchema:
    notes = data.notes if data else None
    door = await services.move_door_to_prev_stage(
        db, door_id, uuid.UUID(current_user.sub), notes=notes,
    )
    return await _build_door_response(db, door)


@router.patch("/doors/{door_id}/move-to")
async def move_door_to_stage(
    data: MoveDoorToStageSchema,
    door_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:move_door")),
    db: AsyncSession = Depends(get_db),
) -> ProductionDoorSchema:
    door = await services.move_door_to_stage(
        db, door_id, data.stage_id, uuid.UUID(current_user.sub), notes=data.notes,
    )
    return await _build_door_response(db, door)


@router.get("/doors/{door_id}/history", response_model=list[DoorStageHistorySchema])
async def get_door_history(
    door_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[DoorStageHistorySchema]:
    from app.auth.models import User
    from sqlalchemy import select

    entries = await services.get_door_history(db, door_id)
    result = []
    for entry in entries:
        user_result = await db.execute(
            select(User.full_name).where(User.id == entry.moved_by)
        )
        user_name = user_result.scalar_one_or_none() or "Неизвестный"

        result.append(DoorStageHistorySchema(
            id=entry.id,
            door_id=entry.door_id,
            from_stage_name=entry.from_stage.name if entry.from_stage else None,
            from_stage_code=entry.from_stage.code if entry.from_stage else None,
            to_stage_name=entry.to_stage.name,
            to_stage_code=entry.to_stage.code,
            moved_by_name=user_name,
            notes=entry.notes,
            moved_at=entry.moved_at,
        ))
    return result


# ─── Print forms ──────────────────────────────────────────────────────────────

@router.get("/doors/{door_id}/print-data", response_model=DoorPrintDataSchema)
async def get_door_print_data(
    door_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> DoorPrintDataSchema:
    return await services.get_door_print_data(db, door_id)


@router.get("/stages/{stage_id}/print-data", response_model=StagePrintDataSchema)
async def get_stage_print_data(
    stage_id: uuid.UUID = Path(...),
    limit: int = Query(100, ge=1, le=500),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> StagePrintDataSchema:
    return await services.get_stage_print_data(db, stage_id, limit=limit)


# ─── Helper ──────────────────────────────────────────────────────────────────

async def _build_door_response(db: AsyncSession, door) -> ProductionDoorSchema:
    """Build ProductionDoorSchema from OrderDoor after movement."""
    from sqlalchemy import select
    from app.orders.models import OrderItem, Order
    from app.configurator.models import DoorConfiguration, DoorModel
    from app.production.models import ProductionStage, ProductionRoute

    item_result = await db.execute(select(OrderItem).where(OrderItem.id == door.order_item_id))
    item = item_result.scalar_one()

    order_result = await db.execute(select(Order.id, Order.order_number).where(Order.id == item.order_id))
    order_row = order_result.one()

    config_result = await db.execute(
        select(DoorConfiguration.door_model_id).where(DoorConfiguration.id == item.configuration_id)
    )
    door_model_id = config_result.scalar_one_or_none()

    stage_name = None
    stage_code = None
    if door.current_stage_id:
        stage_result = await db.execute(
            select(ProductionStage.name, ProductionStage.code)
            .where(ProductionStage.id == door.current_stage_id)
        )
        stage_row = stage_result.one_or_none()
        if stage_row:
            stage_name, stage_code = stage_row

    model_label = None
    route_total = 0
    route_current = 0
    if door_model_id:
        model_result = await db.execute(select(DoorModel.label).where(DoorModel.id == door_model_id))
        model_label = model_result.scalar_one_or_none()

        route_result = await db.execute(
            select(ProductionRoute)
            .where(ProductionRoute.door_model_id == door_model_id)
            .order_by(ProductionRoute.step_order)
        )
        route_steps = route_result.scalars().all()
        route_total = len(route_steps)
        if door.current_stage_id:
            for i, step in enumerate(route_steps):
                if step.stage_id == door.current_stage_id:
                    route_current = i + 1
                    break

    return ProductionDoorSchema(
        door_id=door.id,
        internal_number=door.internal_number,
        marking=door.marking,
        priority=door.priority,
        current_stage_id=door.current_stage_id,
        current_stage_name=stage_name,
        current_stage_code=stage_code,
        order_id=order_row.id,
        order_number=order_row.order_number,
        item_id=item.id,
        door_model_id=door_model_id,
        door_model_label=model_label,
        route_total_steps=route_total,
        route_current_step=route_current,
        notes=door.notes,
        created_at=door.created_at,
    )
