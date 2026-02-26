"""Items — управление позициями заказа (OrderItem)."""
import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import BadRequestException
from app.configurator import service as configurator_service
from app.orders.models import Order, OrderItemStatus, OrderStatus
from app.orders.schemas import OrderItemCreateSchema, OrderItemUpdateSchema
from app.orders.services.crud import (
    _create_item,
    _find_item,
    _get_configuration,
    _next_position_number,
    _recalculate_total,
    get_order,
)


async def add_item(
    db: AsyncSession,
    order_id: uuid.UUID,
    data: OrderItemCreateSchema,
) -> Order:
    order = await get_order(db, order_id)
    if order.status in (OrderStatus.completed, OrderStatus.cancelled):
        raise BadRequestException(
            f"Нельзя добавить позицию к заказу в статусе '{order.status.value}'"
        )

    position = await _next_position_number(db, order_id)
    item = await _create_item(db, order, data, position)

    # Если заказ уже active — сразу фиксируем цену (дозаказ)
    if order.status == OrderStatus.active:
        config = await _get_configuration(db, data.configuration_id)
        core_price = config.price_estimate or Decimal("0")
        core_cost = config.cost_price or Decimal("0")
        item.status = OrderItemStatus.confirmed
        item.locked_price = core_price + (item.variant_price or Decimal("0"))
        item.locked_cost = core_cost + (item.variant_cost or Decimal("0"))

    await db.flush()
    order = await get_order(db, order_id)
    await _recalculate_total(db, order)
    await db.flush()
    return order


async def update_item(
    db: AsyncSession,
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: OrderItemUpdateSchema,
) -> Order:
    order = await get_order(db, order_id)
    item = _find_item(order, item_id)

    if item.status not in (OrderItemStatus.draft, OrderItemStatus.confirmed):
        raise BadRequestException(
            "Изменить позицию можно только в статусе 'draft' или 'confirmed'"
        )

    if data.quantity is not None:
        item.quantity = data.quantity
    if data.priority is not None:
        item.priority = data.priority
    if data.notes is not None:
        item.notes = data.notes

    if data.variant_values is not None:
        item.variant_values = data.variant_values
        variant_price, variant_cost = await configurator_service.calculate_variant_price(
            db, data.variant_values
        )
        item.variant_price = variant_price
        item.variant_cost = variant_cost

    await _recalculate_total(db, order)
    await db.flush()
    return order


async def remove_item(
    db: AsyncSession,
    order_id: uuid.UUID,
    item_id: uuid.UUID,
) -> Order:
    order = await get_order(db, order_id)
    item = _find_item(order, item_id)

    if item.status != OrderItemStatus.draft:
        raise BadRequestException("Удалить можно только позицию в статусе 'draft'")

    await db.delete(item)
    await db.flush()

    order = await get_order(db, order_id)
    await _recalculate_total(db, order)
    await db.flush()
    return order
