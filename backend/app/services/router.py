"""Service types — API endpoints для /service-types."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.auth.schemas import TokenPayload
from app.database import get_db
from app.services import service as svc
from app.services.schemas import (
    ServiceTypeCreateSchema,
    ServiceTypeSchema,
    ServiceTypeUpdateSchema,
)

router = APIRouter(prefix="/service-types", tags=["service-types"])


@router.get("", response_model=list[ServiceTypeSchema])
async def list_service_types(
    include_inactive: bool = False,
    _user: TokenPayload = Depends(require_permission("configurator:view")),
    db: AsyncSession = Depends(get_db),
):
    items = await svc.list_service_types(db, include_inactive=include_inactive)
    return [ServiceTypeSchema.model_validate(s) for s in items]


@router.post("", response_model=ServiceTypeSchema, status_code=201)
async def create_service_type(
    data: ServiceTypeCreateSchema,
    _user: TokenPayload = Depends(require_permission("configurator:admin")),
    db: AsyncSession = Depends(get_db),
):
    obj = await svc.create_service_type(db, data)
    await db.commit()
    return ServiceTypeSchema.model_validate(obj)


@router.patch("/{service_type_id}", response_model=ServiceTypeSchema)
async def update_service_type(
    service_type_id: str,
    data: ServiceTypeUpdateSchema,
    _user: TokenPayload = Depends(require_permission("configurator:admin")),
    db: AsyncSession = Depends(get_db),
):
    import uuid as _uuid
    st_id = _uuid.UUID(service_type_id)
    obj = await svc.update_service_type(db, st_id, data)
    await db.commit()
    return ServiceTypeSchema.model_validate(obj)
