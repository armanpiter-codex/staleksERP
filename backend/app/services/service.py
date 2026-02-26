"""Service types — CRUD operations."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import BadRequestException, NotFoundException
from app.services.models import ServiceType
from app.services.schemas import ServiceTypeCreateSchema, ServiceTypeUpdateSchema


async def list_service_types(
    db: AsyncSession, *, include_inactive: bool = False
) -> list[ServiceType]:
    q = select(ServiceType).order_by(ServiceType.sort_order, ServiceType.created_at)
    if not include_inactive:
        q = q.where(ServiceType.is_active.is_(True))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_service_type(db: AsyncSession, st_id: uuid.UUID) -> ServiceType:
    result = await db.execute(select(ServiceType).where(ServiceType.id == st_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Тип услуги {st_id} не найден")
    return obj


async def create_service_type(
    db: AsyncSession, data: ServiceTypeCreateSchema
) -> ServiceType:
    # Check unique code
    existing = await db.execute(
        select(ServiceType).where(ServiceType.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise BadRequestException(f"Тип услуги с кодом '{data.code}' уже существует")

    obj = ServiceType(**data.model_dump())
    db.add(obj)
    await db.flush()
    return obj


async def update_service_type(
    db: AsyncSession, st_id: uuid.UUID, data: ServiceTypeUpdateSchema
) -> ServiceType:
    obj = await get_service_type(db, st_id)
    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(obj, k, v)
    await db.flush()
    return obj
