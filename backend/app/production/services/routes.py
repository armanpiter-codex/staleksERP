"""Phase-aware production route management (Sprint 16)."""
import uuid
from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import BadRequestException, NotFoundException
from app.configurator.models import DoorModel
from app.production.models import ProductionRoute, ProductionWorkshop
from app.production.schemas import SetRouteSchema


async def get_route_for_model(
    db: AsyncSession,
    door_model_id: uuid.UUID,
) -> list[ProductionRoute]:
    """Get ordered route steps for a door model."""
    result = await db.execute(
        select(ProductionRoute)
        .where(ProductionRoute.door_model_id == door_model_id)
        .options(
            selectinload(ProductionRoute.stage),
            selectinload(ProductionRoute.workshop),
        )
        .order_by(ProductionRoute.phase, ProductionRoute.step_order)
    )
    return list(result.scalars().all())


async def set_route_for_model(
    db: AsyncSession,
    door_model_id: uuid.UUID,
    data: SetRouteSchema,
) -> list[ProductionRoute]:
    """Bulk-replace all route steps for a door model (phase-aware)."""
    # Verify model exists
    model_result = await db.execute(
        select(DoorModel).where(DoorModel.id == door_model_id)
    )
    if not model_result.scalar_one_or_none():
        raise NotFoundException("Модель двери не найдена")

    # Validate phases
    if data.phases:
        _validate_phases(data)

    # Delete existing steps
    await db.execute(
        delete(ProductionRoute).where(ProductionRoute.door_model_id == door_model_id)
    )

    # Insert new steps from phases
    seen_stage_ids: set[uuid.UUID] = set()
    for phase_input in data.phases:
        # Verify workshop exists
        ws_result = await db.execute(
            select(ProductionWorkshop).where(ProductionWorkshop.id == phase_input.workshop_id)
        )
        if not ws_result.scalar_one_or_none():
            raise BadRequestException(f"Цех {phase_input.workshop_id} не найден")

        for stage_input in phase_input.stages:
            if stage_input.stage_id in seen_stage_ids:
                raise BadRequestException("Этап не может повторяться в маршруте")
            seen_stage_ids.add(stage_input.stage_id)

            route = ProductionRoute(
                door_model_id=door_model_id,
                stage_id=stage_input.stage_id,
                step_order=stage_input.step_order,
                is_optional=stage_input.is_optional,
                notes=stage_input.notes,
                phase=phase_input.phase,
                workshop_id=phase_input.workshop_id,
            )
            db.add(route)

    await db.flush()
    return await get_route_for_model(db, door_model_id)


def _validate_phases(data: SetRouteSchema) -> None:
    """Validate phase numbering and workshop uniqueness within phases."""
    phase_numbers = sorted({p.phase for p in data.phases})

    # Phase numbers must be contiguous starting from 1
    expected = list(range(1, len(phase_numbers) + 1))
    if phase_numbers != expected:
        raise BadRequestException(
            f"Номера фаз должны идти последовательно с 1. Получено: {phase_numbers}"
        )

    # Within each phase, workshop_id must be unique
    phase_workshops: dict[int, set[uuid.UUID]] = defaultdict(set)
    for p in data.phases:
        if p.workshop_id in phase_workshops[p.phase]:
            raise BadRequestException(
                f"Цех не может дублироваться в фазе {p.phase}"
            )
        phase_workshops[p.phase].add(p.workshop_id)


async def get_all_routes(
    db: AsyncSession,
) -> dict[uuid.UUID, list[ProductionRoute]]:
    """Get all routes grouped by door_model_id."""
    result = await db.execute(
        select(ProductionRoute)
        .options(
            selectinload(ProductionRoute.stage),
            selectinload(ProductionRoute.workshop),
        )
        .order_by(ProductionRoute.door_model_id, ProductionRoute.phase, ProductionRoute.step_order)
    )
    routes = result.scalars().all()

    grouped: dict[uuid.UUID, list[ProductionRoute]] = defaultdict(list)
    for route in routes:
        grouped[route.door_model_id].append(route)
    return dict(grouped)
