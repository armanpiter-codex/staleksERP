"""Orders CRUD — базовые операции, общие хелперы и расчёт суммы.

Не импортирует другие файлы из services/ — служит основой для остальных.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import BadRequestException, NotFoundException
from app.configurator.models import DoorConfiguration
from app.configurator import service as configurator_service
from app.orders.models import (
    ClientType,
    Facility,
    Order,
    OrderDoor,
    OrderItem,
    OrderItemStatus,
    OrderService,
    OrderStatus,
)
from app.services.models import BillingMethod
from app.orders.schemas import (
    OrderCreateSchema,
    OrderItemCreateSchema,
    OrderUpdateSchema,
)


# ─── Selectinload options ─────────────────────────────────────────────────────

def _order_load_options():
    return [
        selectinload(Order.items).selectinload(OrderItem.configuration),
        selectinload(Order.items).selectinload(OrderItem.doors),
        selectinload(Order.facility),
        selectinload(Order.services),
    ]


# ─── Генерация номера заказа ──────────────────────────────────────────────────

async def _generate_order_number(db: AsyncSession, client_type: ClientType) -> str:
    year = datetime.now(timezone.utc).year
    prefix = "B2B" if client_type == ClientType.b2b else "B2C"
    result = await db.execute(
        select(func.count(Order.id)).where(
            Order.order_number.like(f"{prefix}-{year}-%")
        )
    )
    count = result.scalar_one() or 0
    return f"{prefix}-{year}-{count + 1:04d}"


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _find_item(order: Order, item_id: uuid.UUID) -> OrderItem:
    for item in order.items:
        if item.id == item_id:
            return item
    raise NotFoundException(f"Позиция {item_id} не найдена в заказе {order.id}")


async def _get_configuration(db: AsyncSession, config_id: uuid.UUID) -> DoorConfiguration:
    result = await db.execute(
        select(DoorConfiguration).where(DoorConfiguration.id == config_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise NotFoundException(f"Конфигурация {config_id} не найдена")
    return config


async def _next_position_number(db: AsyncSession, order_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(OrderItem.position_number), 0))
        .where(OrderItem.order_id == order_id)
    )
    return (result.scalar_one() or 0) + 1


async def _create_item(
    db: AsyncSession,
    order: Order,
    data: OrderItemCreateSchema,
    position: int,
) -> OrderItem:
    await _get_configuration(db, data.configuration_id)

    variant_price = Decimal("0")
    variant_cost = Decimal("0")
    variant_values = data.variant_values or {}
    if variant_values:
        variant_price, variant_cost = await configurator_service.calculate_variant_price(
            db, variant_values
        )

    item = OrderItem(
        order_id=order.id,
        configuration_id=data.configuration_id,
        position_number=position,
        quantity=data.quantity,
        status=OrderItemStatus.draft,
        variant_values=variant_values,
        variant_price=variant_price,
        variant_cost=variant_cost,
        priority=data.priority,
        notes=data.notes,
    )
    db.add(item)
    await db.flush()
    return item


# ─── Расчёт суммы заказа ──────────────────────────────────────────────────────

async def _recalculate_total(db: AsyncSession, order: Order) -> None:
    subtotal = Decimal("0")
    for item in (order.items or []):
        if item.status == OrderItemStatus.cancelled:
            continue
        config = item.configuration
        if item.locked_price is not None:
            price = item.locked_price
        else:
            core_price = (config.price_estimate if config else Decimal("0")) or Decimal("0")
            variant_price = item.variant_price or Decimal("0")
            price = core_price + variant_price
        subtotal += price * item.quantity

    discount_amount = Decimal("0")
    if order.discount_percent:
        discount_amount = subtotal * order.discount_percent / Decimal("100")

    # Dynamic services from order_services
    services_total = Decimal("0")
    for svc in (order.services or []):
        if svc.billing_method == BillingMethod.separate:
            services_total += (svc.price or Decimal("0"))

    # Fallback: use legacy columns if no order_services exist
    if not order.services:
        measurement = order.measurement_cost or Decimal("0")
        delivery = order.delivery_cost or Decimal("0")
        installation = order.installation_cost or Decimal("0")
        services_total = measurement + delivery + installation

    total_before_vat = subtotal - discount_amount + services_total
    vat_rate = order.vat_rate or Decimal("16")
    vat_amount = total_before_vat * vat_rate / Decimal("100")
    order.total_price = total_before_vat + vat_amount


# ─── CRUD ─────────────────────────────────────────────────────────────────────

async def get_orders(
    db: AsyncSession,
    *,
    client_type: ClientType | None = None,
    status: OrderStatus | None = None,
    manager_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Order], int]:
    q = (
        select(Order)
        .options(*_order_load_options())
        .order_by(Order.created_at.desc())
    )
    count_q = select(func.count(Order.id))

    if client_type is not None:
        q = q.where(Order.client_type == client_type)
        count_q = count_q.where(Order.client_type == client_type)
    if status is not None:
        q = q.where(Order.status == status)
        count_q = count_q.where(Order.status == status)
    if manager_id is not None:
        q = q.where(Order.manager_id == manager_id)
        count_q = count_q.where(Order.manager_id == manager_id)
    if search:
        pattern = f"%{search}%"
        search_filter = Order.client_name.ilike(pattern) | Order.object_name.ilike(pattern)
        q = q.where(search_filter)
        count_q = count_q.where(search_filter)
    if date_from is not None:
        q = q.where(Order.created_at >= datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc))
        count_q = count_q.where(Order.created_at >= datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc))
    if date_to is not None:
        from datetime import timedelta
        dt_to = datetime(date_to.year, date_to.month, date_to.day, tzinfo=timezone.utc) + timedelta(days=1)
        q = q.where(Order.created_at < dt_to)
        count_q = count_q.where(Order.created_at < dt_to)

    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    result = await db.execute(q.offset(skip).limit(limit))
    return list(result.unique().scalars().all()), total


async def get_order(db: AsyncSession, order_id: uuid.UUID) -> Order:
    result = await db.execute(
        select(Order)
        .options(*_order_load_options())
        .where(Order.id == order_id)
    )
    obj = result.unique().scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Заказ {order_id} не найден")
    return obj


async def create_order(
    db: AsyncSession,
    data: OrderCreateSchema,
    manager_id: uuid.UUID,
) -> Order:
    order_number = await _generate_order_number(db, data.client_type)

    obj = Order(
        order_number=order_number,
        client_name=data.client_name,
        client_phone=data.client_phone,
        client_email=data.client_email,
        client_type=data.client_type,
        client_company=data.client_company,
        notes=data.notes,
        delivery_address=data.delivery_address,
        desired_delivery_date=data.desired_delivery_date,
        prepayment_amount=data.prepayment_amount,
        discount_percent=data.discount_percent,
        credit_days=data.credit_days,
        manager_id=manager_id,
        measurer_id=data.measurer_id,
        measurement_cost=data.measurement_cost,
        object_name=data.object_name,
        sales_channel=data.sales_channel,
        vat_rate=data.vat_rate,
        delivery_cost=data.delivery_cost,
        installation_cost=data.installation_cost,
        source=data.source,
    )
    db.add(obj)
    await db.flush()

    position = 1
    for item_data in data.items:
        await _create_item(db, obj, item_data, position)
        position += 1

    # Legacy: поддержка configuration_ids
    for config_id in data.configuration_ids:
        config = await _get_configuration(db, config_id)
        item = OrderItem(
            order_id=obj.id,
            configuration_id=config_id,
            position_number=position,
            quantity=config.quantity,
            status=OrderItemStatus.draft,
        )
        db.add(item)
        position += 1

    await db.flush()
    obj = await get_order(db, obj.id)
    await _recalculate_total(db, obj)
    return obj


async def update_order(
    db: AsyncSession,
    order_id: uuid.UUID,
    data: OrderUpdateSchema,
) -> Order:
    obj = await get_order(db, order_id)
    if obj.status == OrderStatus.cancelled:
        raise BadRequestException("Нельзя изменить отменённый заказ")

    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(obj, k, v)

    needs_recalc = any(
        getattr(data, f) is not None
        for f in ("discount_percent", "measurement_cost", "delivery_cost", "installation_cost", "vat_rate")
    )
    if needs_recalc:
        await _recalculate_total(db, obj)

    await db.flush()
    return obj


async def delete_order(db: AsyncSession, order_id: uuid.UUID) -> None:
    obj = await get_order(db, order_id)
    if obj.status != OrderStatus.draft:
        raise BadRequestException("Удалить можно только заказ в статусе 'draft'")
    await db.delete(obj)
