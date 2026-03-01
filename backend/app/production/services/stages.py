import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ConflictException, NotFoundException
from app.production.models import ProductionStage
from app.production.schemas import ProductionStageCreateSchema, ProductionStageUpdateSchema


async def list_stages(
    db: AsyncSession,
    *,
    include_inactive: bool = False,
) -> list[ProductionStage]:
    q = select(ProductionStage).order_by(ProductionStage.sort_order, ProductionStage.code)
    if not include_inactive:
        q = q.where(ProductionStage.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_stage(db: AsyncSession, stage_id: uuid.UUID) -> ProductionStage:
    result = await db.execute(
        select(ProductionStage).where(ProductionStage.id == stage_id)
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise NotFoundException("Этап производства не найден")
    return stage


async def create_stage(
    db: AsyncSession,
    data: ProductionStageCreateSchema,
) -> ProductionStage:
    # Check uniqueness
    existing = await db.execute(
        select(ProductionStage).where(ProductionStage.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Этап с кодом '{data.code}' уже существует")

    stage = ProductionStage(**data.model_dump())
    db.add(stage)
    await db.flush()
    return stage


async def update_stage(
    db: AsyncSession,
    stage_id: uuid.UUID,
    data: ProductionStageUpdateSchema,
) -> ProductionStage:
    stage = await get_stage(db, stage_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(stage, key, value)
    await db.flush()
    return stage


async def reorder_stages(
    db: AsyncSession,
    stage_ids: list[uuid.UUID],
) -> list[ProductionStage]:
    for idx, stage_id in enumerate(stage_ids):
        result = await db.execute(
            select(ProductionStage).where(ProductionStage.id == stage_id)
        )
        stage = result.scalar_one_or_none()
        if stage:
            stage.sort_order = (idx + 1) * 10
    await db.flush()
    return await list_stages(db, include_inactive=True)
