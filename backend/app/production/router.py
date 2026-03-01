import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.auth.schemas import TokenPayload
from app.database import get_db
from app.production import services
from app.production.schemas import (
    BatchLaunchSchema,
    DoorLaunchCheckSchema,
    DoorLaunchCheckUpdateSchema,
    DoorPrintDataSchema,
    DoorStageHistorySchema,
    LaunchCheckDefinitionCreateSchema,
    LaunchCheckDefinitionSchema,
    LaunchCheckDefinitionUpdateSchema,
    MoveDoorStageSchema,
    MoveDoorToStageSchema,
    OverdueQueueResponse,
    PendingDoorSchema,
    ProductionDoorSchema,
    ProductionQueueResponse,
    ProductionRouteSchema,
    ProductionStageCreateSchema,
    ProductionStageSchema,
    ProductionStageUpdateSchema,
    ProductionWorkshopSchema,
    ReorderLaunchChecksSchema,
    ReorderStagesSchema,
    ReorderWorkshopsSchema,
    RoutePhaseSchema,
    RouteStepSchema,
    RouteTrackSchema,
    SetRouteSchema,
    StageCounterSchema,
    StagePrintDataSchema,
    WorkshopCounterSchema,
    WorkshopCreateSchema,
    WorkshopProgressSchema,
    WorkshopUpdateSchema,
)

router = APIRouter(prefix="/production", tags=["Production"])


# ─── Workshops CRUD ──────────────────────────────────────────────────────────

@router.get("/workshops", response_model=list[ProductionWorkshopSchema])
async def list_workshops(
    include_inactive: bool = Query(False),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[ProductionWorkshopSchema]:
    workshops = await services.list_workshops(db, include_inactive=include_inactive)
    return [ProductionWorkshopSchema.model_validate(w) for w in workshops]


@router.post("/workshops", response_model=ProductionWorkshopSchema, status_code=201)
async def create_workshop(
    data: WorkshopCreateSchema,
    current_user: TokenPayload = Depends(require_permission("production:workshops")),
    db: AsyncSession = Depends(get_db),
) -> ProductionWorkshopSchema:
    workshop = await services.create_workshop(db, data)
    return ProductionWorkshopSchema.model_validate(workshop)


@router.patch("/workshops/reorder", response_model=list[ProductionWorkshopSchema])
async def reorder_workshops(
    data: ReorderWorkshopsSchema,
    current_user: TokenPayload = Depends(require_permission("production:workshops")),
    db: AsyncSession = Depends(get_db),
) -> list[ProductionWorkshopSchema]:
    workshops = await services.reorder_workshops(db, data.workshop_ids)
    return [ProductionWorkshopSchema.model_validate(w) for w in workshops]


@router.patch("/workshops/{workshop_id}", response_model=ProductionWorkshopSchema)
async def update_workshop(
    data: WorkshopUpdateSchema,
    workshop_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:workshops")),
    db: AsyncSession = Depends(get_db),
) -> ProductionWorkshopSchema:
    workshop = await services.update_workshop(db, workshop_id, data)
    return ProductionWorkshopSchema.model_validate(workshop)


# ─── Stages CRUD ─────────────────────────────────────────────────────────────

@router.get("/stages", response_model=list[ProductionStageSchema])
async def list_stages(
    include_inactive: bool = Query(False),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[ProductionStageSchema]:
    stages = await services.list_stages(db, include_inactive=include_inactive)
    return [_stage_to_schema(s) for s in stages]


@router.post("/stages", response_model=ProductionStageSchema, status_code=201)
async def create_stage(
    data: ProductionStageCreateSchema,
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> ProductionStageSchema:
    stage = await services.create_stage(db, data)
    return _stage_to_schema(stage)


@router.patch("/stages/reorder", response_model=list[ProductionStageSchema])
async def reorder_stages(
    data: ReorderStagesSchema,
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> list[ProductionStageSchema]:
    stages = await services.reorder_stages(db, data.stage_ids)
    return [_stage_to_schema(s) for s in stages]


@router.patch("/stages/{stage_id}", response_model=ProductionStageSchema)
async def update_stage(
    data: ProductionStageUpdateSchema,
    stage_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> ProductionStageSchema:
    stage = await services.update_stage(db, stage_id, data)
    return _stage_to_schema(stage)


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
        result.append(_build_route_schema(model_id, model.code, model.label, route_steps))
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
    return _build_route_schema(door_model_id, model.code, model.label, route_steps)


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
    return _build_route_schema(door_model_id, model.code, model.label, route_steps)


# ─── Production Queue ────────────────────────────────────────────────────────

@router.get("/queue", response_model=ProductionQueueResponse)
async def get_production_queue(
    stage_id: uuid.UUID | None = Query(None),
    workshop_id: uuid.UUID | None = Query(None),
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
        workshop_id=workshop_id,
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


@router.get("/queue/workshop-counters", response_model=list[WorkshopCounterSchema])
async def get_workshop_counters(
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[WorkshopCounterSchema]:
    return await services.get_workshop_counters(db)


# ─── Overdue doors (Sprint 18) ───────────────────────────────────────────────

@router.get("/overdue", response_model=OverdueQueueResponse)
async def get_overdue_doors(
    search: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> OverdueQueueResponse:
    return await services.get_overdue_doors(db, search=search, limit=limit, offset=offset)


# ─── Door stage movement ────────────────────────────────────────────────────

@router.patch("/doors/{door_id}/move-next")
async def move_door_next(
    door_id: uuid.UUID = Path(...),
    data: MoveDoorStageSchema | None = None,
    current_user: TokenPayload = Depends(require_permission("production:move_door")),
    db: AsyncSession = Depends(get_db),
) -> ProductionDoorSchema:
    notes = data.notes if data else None
    ws_id = data.workshop_id if data else None
    door = await services.move_door_to_next_stage(
        db, door_id, uuid.UUID(current_user.sub),
        workshop_id=ws_id, notes=notes,
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
    ws_id = data.workshop_id if data else None
    door = await services.move_door_to_prev_stage(
        db, door_id, uuid.UUID(current_user.sub),
        workshop_id=ws_id, notes=notes,
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
        db, door_id, data.stage_id, uuid.UUID(current_user.sub),
        workshop_id=data.workshop_id, notes=data.notes,
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


@router.get("/doors/{door_id}/progress", response_model=list[WorkshopProgressSchema])
async def get_door_progress(
    door_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[WorkshopProgressSchema]:
    entries = await services.get_door_progress(db, door_id)
    return [
        WorkshopProgressSchema(
            workshop_id=e.workshop_id,
            workshop_name=e.workshop.name if e.workshop else "",
            workshop_code=e.workshop.code if e.workshop else "",
            workshop_color=e.workshop.color if e.workshop else None,
            phase=e.phase,
            current_stage_id=e.current_stage_id,
            current_stage_name=e.current_stage.name if e.current_stage else None,
            current_stage_code=e.current_stage.code if e.current_stage else None,
            status=e.status,
        )
        for e in entries
    ]


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


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _stage_to_schema(stage) -> ProductionStageSchema:
    return ProductionStageSchema(
        id=stage.id,
        code=stage.code,
        name=stage.name,
        description=stage.description,
        sort_order=stage.sort_order,
        is_active=stage.is_active,
        workshop_id=stage.workshop_id,
        workshop_name=stage.workshop.name if stage.workshop else None,
        workshop_code=stage.workshop.code if stage.workshop else None,
        workshop_color=stage.workshop.color if stage.workshop else None,
        created_at=stage.created_at,
        updated_at=stage.updated_at,
    )


def _step_to_schema(step) -> RouteStepSchema:
    return RouteStepSchema(
        id=step.id,
        stage_id=step.stage_id,
        stage_code=step.stage.code if step.stage else "",
        stage_name=step.stage.name if step.stage else "",
        step_order=step.step_order,
        is_optional=step.is_optional,
        notes=step.notes,
        phase=step.phase,
        workshop_id=step.workshop_id,
        workshop_name=step.workshop.name if step.workshop else None,
        workshop_code=step.workshop.code if step.workshop else None,
        workshop_color=step.workshop.color if step.workshop else None,
    )


def _build_route_schema(model_id, model_code, model_label, route_steps) -> ProductionRouteSchema:
    flat_steps = [_step_to_schema(s) for s in route_steps]

    phase_map: dict[int, dict[uuid.UUID, list[RouteStepSchema]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for s in flat_steps:
        if s.workshop_id:
            phase_map[s.phase][s.workshop_id].append(s)

    phases = []
    for phase_num in sorted(phase_map.keys()):
        tracks = []
        for ws_id, steps in phase_map[phase_num].items():
            sorted_steps = sorted(steps, key=lambda x: x.step_order)
            tracks.append(RouteTrackSchema(
                workshop_id=ws_id,
                workshop_name=sorted_steps[0].workshop_name or "",
                workshop_code=sorted_steps[0].workshop_code or "",
                workshop_color=sorted_steps[0].workshop_color,
                steps=sorted_steps,
            ))
        phases.append(RoutePhaseSchema(phase=phase_num, tracks=tracks))

    return ProductionRouteSchema(
        door_model_id=model_id,
        door_model_code=model_code,
        door_model_label=model_label,
        phases=phases,
        steps=flat_steps,
    )


async def _build_door_response(db: AsyncSession, door) -> ProductionDoorSchema:
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from app.orders.models import OrderItem, Order
    from app.configurator.models import DoorConfiguration, DoorModel
    from app.production.models import (
        ProductionStage, ProductionRoute, DoorWorkshopProgress,
    )

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
    if door_model_id:
        model_result = await db.execute(select(DoorModel.label).where(DoorModel.id == door_model_id))
        model_label = model_result.scalar_one_or_none()
        rc = await db.execute(
            select(func.count(ProductionRoute.id))
            .where(ProductionRoute.door_model_id == door_model_id)
        )
        route_total = rc.scalar_one() or 0

    prog_result = await db.execute(
        select(DoorWorkshopProgress)
        .where(DoorWorkshopProgress.door_id == door.id)
        .options(
            selectinload(DoorWorkshopProgress.workshop),
            selectinload(DoorWorkshopProgress.current_stage),
        )
        .order_by(DoorWorkshopProgress.phase, DoorWorkshopProgress.workshop_id)
    )
    progress_entries = list(prog_result.scalars().all())

    workshop_progress = []
    current_phase = None
    total_phases = 0

    if progress_entries:
        total_phases = len({p.phase for p in progress_entries})
        active = [p for p in progress_entries if p.status == "active"]
        if active:
            current_phase = active[0].phase
        for pe in progress_entries:
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
            ))

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
        route_current_step=0,
        notes=door.notes,
        created_at=door.created_at,
        current_phase=current_phase,
        total_phases=total_phases,
        workshop_progress=workshop_progress,
    )


# ─── Launch Check Definitions (Sprint 17) ────────────────────────────────────

@router.get("/launch-checks", response_model=list[LaunchCheckDefinitionSchema])
async def list_launch_checks(
    include_inactive: bool = Query(False),
    current_user: TokenPayload = Depends(require_permission("production:read")),
    db: AsyncSession = Depends(get_db),
) -> list[LaunchCheckDefinitionSchema]:
    checks = await services.list_check_definitions(db, include_inactive=include_inactive)
    return [LaunchCheckDefinitionSchema.model_validate(c) for c in checks]


@router.post("/launch-checks", response_model=LaunchCheckDefinitionSchema, status_code=201)
async def create_launch_check(
    data: LaunchCheckDefinitionCreateSchema,
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> LaunchCheckDefinitionSchema:
    check = await services.create_check_definition(db, data)
    return LaunchCheckDefinitionSchema.model_validate(check)


@router.patch("/launch-checks/reorder", response_model=list[LaunchCheckDefinitionSchema])
async def reorder_launch_checks(
    data: ReorderLaunchChecksSchema,
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> list[LaunchCheckDefinitionSchema]:
    checks = await services.reorder_check_definitions(db, data)
    return [LaunchCheckDefinitionSchema.model_validate(c) for c in checks]


@router.patch("/launch-checks/{check_id}", response_model=LaunchCheckDefinitionSchema)
async def update_launch_check(
    check_id: uuid.UUID = Path(...),
    data: LaunchCheckDefinitionUpdateSchema = ...,
    current_user: TokenPayload = Depends(require_permission("production:stages")),
    db: AsyncSession = Depends(get_db),
) -> LaunchCheckDefinitionSchema:
    check = await services.update_check_definition(db, check_id, data)
    return LaunchCheckDefinitionSchema.model_validate(check)


# ─── Pending Doors & Door Launch Checks (Sprint 17) ──────────────────────────

@router.get("/pending-doors", response_model=list[PendingDoorSchema])
async def list_pending_doors(
    check_ids: str | None = Query(None, description="Comma-separated check definition UUIDs to filter by"),
    priority: bool | None = Query(None),
    search: str | None = Query(None),
    current_user: TokenPayload = Depends(require_permission("production:launch")),
    db: AsyncSession = Depends(get_db),
) -> list[PendingDoorSchema]:
    parsed_check_ids = None
    if check_ids:
        parsed_check_ids = [uuid.UUID(cid.strip()) for cid in check_ids.split(",") if cid.strip()]
    return await services.get_pending_doors(
        db,
        check_ids=parsed_check_ids,
        priority_filter=priority,
        search=search,
    )


@router.get("/doors/{door_id}/launch-checks", response_model=list[DoorLaunchCheckSchema])
async def get_door_launch_checks(
    door_id: uuid.UUID = Path(...),
    current_user: TokenPayload = Depends(require_permission("production:launch")),
    db: AsyncSession = Depends(get_db),
) -> list[DoorLaunchCheckSchema]:
    return await services.get_door_launch_checks(db, door_id)


@router.patch(
    "/doors/{door_id}/launch-checks/{check_id}",
    response_model=DoorLaunchCheckSchema,
)
async def update_door_launch_check(
    door_id: uuid.UUID = Path(...),
    check_id: uuid.UUID = Path(...),
    data: DoorLaunchCheckUpdateSchema = ...,
    current_user: TokenPayload = Depends(require_permission("production:launch")),
    db: AsyncSession = Depends(get_db),
) -> DoorLaunchCheckSchema:
    user_id = uuid.UUID(current_user.sub)
    return await services.update_door_launch_check(db, door_id, check_id, data, user_id)


@router.post("/batch-launch", status_code=200)
async def batch_launch(
    data: BatchLaunchSchema,
    current_user: TokenPayload = Depends(require_permission("production:launch")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    user_id = uuid.UUID(current_user.sub)
    return await services.batch_launch_doors(db, data, user_id)
