import uuid
from collections import defaultdict

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import NotFoundException
from app.configurator.models import DoorModel
from app.production.models import ProductionRoute
from app.production.schemas import SetRouteSchema


async def get_route_for_model(
    db: AsyncSession,
    door_model_id: uuid.UUID,
) -> list[ProductionRoute]:
    """Get ordered route steps for a door model."""
    result = await db.execute(
        select(ProductionRoute)
        .where(ProductionRoute.door_model_id == door_model_id)
        .options(selectinload(ProductionRoute.stage))
        .order_by(ProductionRoute.step_order)
    )
    return list(result.scalars().all())


async def set_route_for_model(
    db: AsyncSession,
    door_model_id: uuid.UUID,
    data: SetRouteSchema,
) -> list[ProductionRoute]:
    """Bulk-replace all route steps for a door model."""
    # Verify model exists
    model_result = await db.execute(
        select(DoorModel).where(DoorModel.id == door_model_id)
    )
    if not model_result.scalar_one_or_none():
        raise NotFoundException("Модель двери не найдена")

    # Delete existing steps
    await db.execute(
        delete(ProductionRoute).where(ProductionRoute.door_model_id == door_model_id)
    )

    # Insert new steps
    for step_input in data.steps:
        route = ProductionRoute(
            door_model_id=door_model_id,
            stage_id=step_input.stage_id,
            step_order=step_input.step_order,
            is_optional=step_input.is_optional,
            notes=step_input.notes,
        )
        db.add(route)

    await db.flush()
    return await get_route_for_model(db, door_model_id)


async def get_all_routes(
    db: AsyncSession,
) -> dict[uuid.UUID, list[ProductionRoute]]:
    """Get all routes grouped by door_model_id."""
    result = await db.execute(
        select(ProductionRoute)
        .options(selectinload(ProductionRoute.stage))
        .order_by(ProductionRoute.door_model_id, ProductionRoute.step_order)
    )
    routes = result.scalars().all()

    grouped: dict[uuid.UUID, list[ProductionRoute]] = defaultdict(list)
    for route in routes:
        grouped[route.door_model_id].append(route)
    return dict(grouped)
