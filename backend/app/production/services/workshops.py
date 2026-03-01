import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import ConflictException, NotFoundException
from app.production.models import ProductionWorkshop
from app.production.schemas import WorkshopCreateSchema, WorkshopUpdateSchema


async def list_workshops(
    db: AsyncSession,
    *,
    include_inactive: bool = False,
) -> list[ProductionWorkshop]:
    q = select(ProductionWorkshop).order_by(
        ProductionWorkshop.sort_order, ProductionWorkshop.code
    )
    if not include_inactive:
        q = q.where(ProductionWorkshop.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_workshop(db: AsyncSession, workshop_id: uuid.UUID) -> ProductionWorkshop:
    result = await db.execute(
        select(ProductionWorkshop).where(ProductionWorkshop.id == workshop_id)
    )
    workshop = result.scalar_one_or_none()
    if not workshop:
        raise NotFoundException("Цех не найден")
    return workshop


async def create_workshop(
    db: AsyncSession,
    data: WorkshopCreateSchema,
) -> ProductionWorkshop:
    existing = await db.execute(
        select(ProductionWorkshop).where(ProductionWorkshop.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise ConflictException(f"Цех с кодом '{data.code}' уже существует")

    workshop = ProductionWorkshop(**data.model_dump())
    db.add(workshop)
    await db.flush()
    return workshop


async def update_workshop(
    db: AsyncSession,
    workshop_id: uuid.UUID,
    data: WorkshopUpdateSchema,
) -> ProductionWorkshop:
    workshop = await get_workshop(db, workshop_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workshop, key, value)
    await db.flush()
    return workshop


async def reorder_workshops(
    db: AsyncSession,
    workshop_ids: list[uuid.UUID],
) -> list[ProductionWorkshop]:
    for idx, wid in enumerate(workshop_ids):
        result = await db.execute(
            select(ProductionWorkshop).where(ProductionWorkshop.id == wid)
        )
        workshop = result.scalar_one_or_none()
        if workshop:
            workshop.sort_order = (idx + 1) * 10
    await db.flush()
    return await list_workshops(db, include_inactive=True)
