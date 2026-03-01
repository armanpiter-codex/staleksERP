"""Orders router — полный REST API модуля заказов.

Sprint 2: Order + OrderItem + OrderDoor endpoints.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_any_permission, require_permission
from app.auth.models import User
from app.auth.schemas import TokenPayload
from app.database import get_db
from app.orders import service
from app.orders.models import ClientType, Facility, OrderService, OrderStatus
from app.orders.schemas import (
    ApplyMarkingsSchema,
    BatchDoorStatusSchema,
    DoorStatusTransitionSchema,
    FacilityCreateSchema,
    FacilitySchema,
    FacilityUpdateSchema,
    GenerateDoorsSchema,
    ItemStatusTransitionSchema,
    OrderCreateSchema,
    OrderDoorSchema,
    OrderDoorUpdateSchema,
    OrderItemCreateSchema,
    OrderItemSchema,
    OrderItemUpdateSchema,
    OrderSchema,
    OrderServiceCreateSchema,
    OrderServiceSchema,
    OrderServiceUpdateSchema,
    OrderSummarySchema,
    OrderUpdateSchema,
    PaginatedOrdersSchema,
    StatusTransitionSchema,
)
from app.services.models import ServiceType

router = APIRouter(prefix="/orders", tags=["orders"])


async def _enrich_order(db: AsyncSession, order_schema: OrderSchema, order_obj) -> OrderSchema:
    """Добавляет manager_name и facility_name в схему заказа."""
    result = await db.execute(select(User.full_name).where(User.id == order_obj.manager_id))
    row = result.first()
    order_schema.manager_name = row[0] if row else None
    order_schema.facility_name = order_obj.facility.name if order_obj.facility else None
    return order_schema


# ══════════════════════════════════════════════════════════════════════════════
# ─── Order CRUD ──────────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@router.get(
    "",
    response_model=PaginatedOrdersSchema,
    summary="Список заказов с пагинацией и фильтрацией",
)
async def list_orders(
    client_type: ClientType | None = Query(None),
    status: OrderStatus | None = Query(None),
    search: str | None = Query(None, description="Поиск по имени клиента или объекту"),
    manager_id: uuid.UUID | None = Query(None, description="Фильтр по менеджеру (только для owner/admin)"),
    date_from: date | None = Query(None, description="Дата создания от (включительно)"),
    date_to: date | None = Query(None, description="Дата создания до (включительно)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(
        require_any_permission("orders:read", "orders:read_b2b", "orders:read_b2c")
    ),
) -> PaginatedOrdersSchema:
    effective_client_type = client_type
    effective_manager_id = manager_id  # owner/admin могут фильтровать по любому менеджеру
    if "orders:read" not in current_user.permissions:
        # МОП видит только свои заказы (принудительный фильтр)
        effective_manager_id = uuid.UUID(current_user.sub)
        if "orders:read_b2b" in current_user.permissions and client_type != ClientType.b2c:
            effective_client_type = ClientType.b2b
        elif "orders:read_b2c" in current_user.permissions and client_type != ClientType.b2b:
            effective_client_type = ClientType.b2c

    skip = (page - 1) * page_size
    orders, total = await service.get_orders(
        db,
        client_type=effective_client_type,
        status=status,
        search=search,
        manager_id=effective_manager_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=page_size,
    )
    pages = (total + page_size - 1) // page_size if total > 0 else 1

    # Bulk fetch manager names
    manager_ids = list({o.manager_id for o in orders})
    manager_names: dict[uuid.UUID, str] = {}
    if manager_ids:
        users_result = await db.execute(
            select(User.id, User.full_name).where(User.id.in_(manager_ids))
        )
        manager_names = {row[0]: row[1] for row in users_result.all()}

    items = []
    for o in orders:
        schema = OrderSchema.model_validate(o)
        schema.manager_name = manager_names.get(o.manager_id)
        schema.facility_name = o.facility.name if o.facility else None
        items.append(schema)

    return PaginatedOrdersSchema(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=OrderSchema,
    status_code=201,
    summary="Создать новый заказ",
)
async def create_order(
    data: OrderCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    obj = await service.create_order(
        db, data, manager_id=uuid.UUID(current_user.sub)
    )
    await db.commit()
    obj = await service.get_order(db, obj.id)
    return OrderSchema.model_validate(obj)


@router.get(
    "/{order_id}",
    response_model=OrderSchema,
    summary="Получить заказ по ID",
)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:read", "orders:read_b2b", "orders:read_b2c")
    ),
) -> OrderSchema:
    obj = await service.get_order(db, order_id)
    schema = OrderSchema.model_validate(obj)
    return await _enrich_order(db, schema, obj)


@router.patch(
    "/{order_id}",
    response_model=OrderSchema,
    summary="Обновить заказ",
)
async def update_order(
    order_id: uuid.UUID,
    data: OrderUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    obj = await service.update_order(db, order_id, data)
    await db.commit()
    obj = await service.get_order(db, order_id)
    return OrderSchema.model_validate(obj)


@router.delete(
    "/{order_id}",
    status_code=204,
    summary="Удалить заказ (только draft)",
)
async def delete_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_permission("orders:delete")),
) -> None:
    await service.delete_order(db, order_id)
    await db.commit()


@router.patch(
    "/{order_id}/status",
    response_model=OrderSchema,
    summary="Перевести заказ в новый статус (workflow)",
)
async def transition_order_status(
    order_id: uuid.UUID,
    data: StatusTransitionSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    obj = await service.transition_order_status(db, order_id, data.status)
    await db.commit()
    obj = await service.get_order(db, order_id)
    return OrderSchema.model_validate(obj)


@router.get(
    "/{order_id}/summary",
    response_model=OrderSummarySchema,
    summary="Финансовая сводка заказа (с НДС)",
)
async def get_order_summary(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:read", "orders:read_b2b", "orders:read_b2c")
    ),
) -> OrderSummarySchema:
    return await service.get_order_summary(db, order_id)


# ══════════════════════════════════════════════════════════════════════════════
# ─── OrderItem (позиции) ─────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{order_id}/items",
    response_model=OrderSchema,
    status_code=201,
    summary="Добавить позицию к заказу",
)
async def add_item(
    order_id: uuid.UUID,
    data: OrderItemCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    await service.add_item(db, order_id, data)
    await db.commit()
    obj = await service.get_order(db, order_id)
    return OrderSchema.model_validate(obj)


@router.patch(
    "/{order_id}/items/{item_id}",
    response_model=OrderSchema,
    summary="Обновить позицию (quantity, priority, notes)",
)
async def update_item(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: OrderItemUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    await service.update_item(db, order_id, item_id, data)
    await db.commit()
    obj = await service.get_order(db, order_id)
    return OrderSchema.model_validate(obj)


@router.delete(
    "/{order_id}/items/{item_id}",
    response_model=OrderSchema,
    summary="Удалить позицию (только draft)",
)
async def remove_item(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    await service.remove_item(db, order_id, item_id)
    await db.commit()
    obj = await service.get_order(db, order_id)
    return OrderSchema.model_validate(obj)


@router.patch(
    "/{order_id}/items/{item_id}/status",
    response_model=OrderSchema,
    summary="Перевести позицию в новый статус (workflow)",
)
async def transition_item_status(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemStatusTransitionSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    await service.transition_item_status(db, order_id, item_id, data.status)
    await db.commit()
    obj = await service.get_order(db, order_id)
    return OrderSchema.model_validate(obj)


# ══════════════════════════════════════════════════════════════════════════════
# ─── OrderDoor (двери) ───────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{order_id}/items/{item_id}/doors/generate",
    response_model=list[OrderDoorSchema],
    status_code=201,
    summary="Генерация дверей пакетом",
)
async def generate_doors(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: GenerateDoorsSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> list[OrderDoorSchema]:
    doors = await service.generate_doors(db, order_id, item_id, data)
    await db.commit()
    return [OrderDoorSchema.model_validate(d) for d in doors]


# NB: batch-status MUST come before {door_id} routes to avoid route conflict
@router.patch(
    "/{order_id}/doors/batch-status",
    response_model=list[OrderDoorSchema],
    summary="Массовый перевод статуса дверей",
)
async def batch_transition_door_status(
    order_id: uuid.UUID,
    data: BatchDoorStatusSchema,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(
        require_any_permission(
            "orders:write", "orders:write_b2b", "orders:write_b2c",
            "doors:transition_to_in_production", "doors:transition_to_ready",
            "doors:transition_to_shipped", "doors:transition_to_completed",
        )
    ),
) -> list[OrderDoorSchema]:
    doors = await service.batch_transition_door_status(
        db, order_id, data, user_permissions=current_user.permissions
    )
    await db.commit()
    # Re-fetch to ensure fresh data
    order = await service.get_order(db, order_id)
    result = []
    for d in doors:
        fresh = service._find_door_in_order(order, d.id)
        result.append(OrderDoorSchema.model_validate(fresh))
    return result


@router.patch(
    "/{order_id}/doors/{door_id}",
    response_model=OrderDoorSchema,
    summary="Обновить дверь (marking, floor и т.д.)",
)
async def update_door(
    order_id: uuid.UUID,
    door_id: uuid.UUID,
    data: OrderDoorUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderDoorSchema:
    door = await service.update_door(db, order_id, door_id, data)
    await db.commit()
    # Re-fetch to ensure fresh data
    order = await service.get_order(db, order_id)
    door = service._find_door_in_order(order, door_id)
    return OrderDoorSchema.model_validate(door)


@router.patch(
    "/{order_id}/doors/{door_id}/status",
    response_model=OrderDoorSchema,
    summary="Перевести дверь в новый статус (workflow)",
)
async def transition_door_status(
    order_id: uuid.UUID,
    door_id: uuid.UUID,
    data: DoorStatusTransitionSchema,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(
        require_any_permission(
            "orders:write", "orders:write_b2b", "orders:write_b2c",
            "doors:transition_to_in_production", "doors:transition_to_ready",
            "doors:transition_to_shipped", "doors:transition_to_completed",
        )
    ),
) -> OrderDoorSchema:
    door = await service.transition_door_status(
        db, order_id, door_id, data.status,
        user_permissions=current_user.permissions,
        user_id=uuid.UUID(current_user.sub),
    )
    await db.commit()
    order = await service.get_order(db, order_id)
    door = service._find_door_in_order(order, door_id)
    return OrderDoorSchema.model_validate(door)


@router.patch(
    "/{order_id}/doors/{door_id}/priority",
    response_model=OrderDoorSchema,
    summary="Переключить приоритет двери",
)
async def toggle_door_priority(
    order_id: uuid.UUID,
    door_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderDoorSchema:
    door = await service.toggle_door_priority(db, order_id, door_id)
    await db.commit()
    order = await service.get_order(db, order_id)
    door = service._find_door_in_order(order, door_id)
    return OrderDoorSchema.model_validate(door)


@router.delete(
    "/{order_id}/doors/{door_id}",
    status_code=204,
    summary="Удалить дверь (только pending)",
)
async def delete_door(
    order_id: uuid.UUID,
    door_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> None:
    await service.delete_door(db, order_id, door_id)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# ─── Marking (Sprint 8) ──────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/{order_id}/items/{item_id}/apply-markings",
    response_model=OrderSchema,
    summary="Применить маркировку ко всем дверям позиции",
)
async def apply_markings(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ApplyMarkingsSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write", "orders:write_b2b", "orders:write_b2c")
    ),
) -> OrderSchema:
    order = await service.apply_markings(db, order_id, item_id, data)
    await db.commit()
    order = await service.get_order(db, order_id)
    return OrderSchema.model_validate(order)


# ══════════════════════════════════════════════════════════════════════════════
# ─── Order Services (услуги заказа) ──────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{order_id}/services",
    response_model=list[OrderServiceSchema],
    summary="Список услуг заказа",
)
async def list_order_services(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:read", "orders:read_b2b", "orders:read_b2c")
    ),
) -> list[OrderServiceSchema]:
    order = await service.get_order(db, order_id)
    return [OrderServiceSchema.model_validate(s) for s in (order.services or [])]


@router.post(
    "/{order_id}/services",
    response_model=OrderServiceSchema,
    status_code=201,
    summary="Добавить услугу к заказу",
)
async def add_order_service(
    order_id: uuid.UUID,
    data: OrderServiceCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_any_permission("orders:write")),
) -> OrderServiceSchema:
    from app.common.exceptions import BadRequestException
    order = await service.get_order(db, order_id)
    if order.status in (OrderStatus.active, OrderStatus.completed, OrderStatus.cancelled):
        raise BadRequestException("Нельзя изменять услуги активного/завершённого заказа")

    # Check service type exists
    st_result = await db.execute(select(ServiceType).where(ServiceType.id == data.service_type_id))
    st = st_result.scalar_one_or_none()
    if not st:
        raise BadRequestException(f"Тип услуги {data.service_type_id} не найден")

    # Check not duplicate
    for existing in (order.services or []):
        if existing.service_type_id == data.service_type_id:
            raise BadRequestException(f"Услуга '{st.name}' уже добавлена к заказу")

    billing = data.billing_method if data.billing_method is not None else st.billing_method
    svc_obj = OrderService(
        order_id=order.id,
        service_type_id=data.service_type_id,
        price=data.price,
        billing_method=billing,
        billing_entity_name=data.billing_entity_name,
        notes=data.notes,
    )
    db.add(svc_obj)
    await db.flush()
    await db.commit()
    # Re-fetch to get relationship loaded
    await db.refresh(svc_obj)
    return OrderServiceSchema.model_validate(svc_obj)


@router.patch(
    "/{order_id}/services/{service_id}",
    response_model=OrderServiceSchema,
    summary="Обновить услугу заказа",
)
async def update_order_service(
    order_id: uuid.UUID,
    service_id: uuid.UUID,
    data: OrderServiceUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_any_permission("orders:write")),
) -> OrderServiceSchema:
    from app.common.exceptions import BadRequestException, NotFoundException
    order = await service.get_order(db, order_id)
    if order.status in (OrderStatus.active, OrderStatus.completed, OrderStatus.cancelled):
        raise BadRequestException("Нельзя изменять услуги активного/завершённого заказа")

    svc_obj = None
    for s in (order.services or []):
        if s.id == service_id:
            svc_obj = s
            break
    if not svc_obj:
        raise NotFoundException(f"Услуга {service_id} не найдена в заказе")

    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(svc_obj, k, v)
    await db.flush()
    await db.commit()
    await db.refresh(svc_obj)
    return OrderServiceSchema.model_validate(svc_obj)


@router.delete(
    "/{order_id}/services/{service_id}",
    status_code=204,
    summary="Удалить услугу из заказа",
)
async def remove_order_service(
    order_id: uuid.UUID,
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(require_any_permission("orders:write")),
):
    from app.common.exceptions import BadRequestException, NotFoundException
    order = await service.get_order(db, order_id)
    if order.status in (OrderStatus.active, OrderStatus.completed, OrderStatus.cancelled):
        raise BadRequestException("Нельзя изменять услуги активного/завершённого заказа")

    svc_obj = None
    for s in (order.services or []):
        if s.id == service_id:
            svc_obj = s
            break
    if not svc_obj:
        raise NotFoundException(f"Услуга {service_id} не найдена в заказе")

    await db.delete(svc_obj)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# ─── Facilities (объекты строительства) ──────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

facilities_router = APIRouter(prefix="/facilities", tags=["facilities"])


@facilities_router.get(
    "",
    response_model=list[FacilitySchema],
    summary="Список объектов строительства",
)
async def list_facilities(
    include_inactive: bool = Query(False, description="Включить архивные объекты"),
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:read", "orders:read_b2b", "orders:read_b2c")
    ),
) -> list[FacilitySchema]:
    stmt = select(Facility).order_by(Facility.name)
    if not include_inactive:
        stmt = stmt.where(Facility.is_active.is_(True))
    result = await db.execute(stmt)
    facilities = result.scalars().all()
    return [FacilitySchema.model_validate(f) for f in facilities]


@facilities_router.post(
    "",
    response_model=FacilitySchema,
    status_code=201,
    summary="Создать объект строительства (admin/owner)",
)
async def create_facility(
    data: FacilityCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write")
    ),
) -> FacilitySchema:
    facility = Facility(name=data.name.strip())
    db.add(facility)
    await db.flush()
    await db.commit()
    await db.refresh(facility)
    return FacilitySchema.model_validate(facility)


@facilities_router.patch(
    "/{facility_id}",
    response_model=FacilitySchema,
    summary="Обновить объект строительства (admin/owner)",
)
async def update_facility(
    facility_id: uuid.UUID,
    data: FacilityUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: TokenPayload = Depends(
        require_any_permission("orders:write")
    ),
) -> FacilitySchema:
    result = await db.execute(select(Facility).where(Facility.id == facility_id))
    facility = result.scalar_one_or_none()
    if not facility:
        from app.common.exceptions import NotFoundException
        raise NotFoundException(f"Объект {facility_id} не найден")
    if data.name is not None:
        facility.name = data.name.strip()
    if data.is_active is not None:
        facility.is_active = data.is_active
    await db.commit()
    await db.refresh(facility)
    return FacilitySchema.model_validate(facility)
