"""Workflow — переходы статусов заказа и позиций."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import BadRequestException
from app.orders.models import DoorStatus, Order, OrderItemStatus, OrderStatus
from app.orders.services.crud import _find_item, _recalculate_total, get_order
from app.orders.services.doors import _generate_doors_for_item


# ─── Constants ────────────────────────────────────────────────────────────────

ALLOWED_ORDER_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.draft:           [OrderStatus.confirmed, OrderStatus.cancelled],
    OrderStatus.confirmed:       [OrderStatus.draft, OrderStatus.contract_signed, OrderStatus.cancelled],
    OrderStatus.contract_signed: [OrderStatus.confirmed, OrderStatus.cancelled],
    # active достигается только авто (из transition_item_status); здесь не в allowed,
    # чтобы заблокировать ручной переход через API
    OrderStatus.active:          [OrderStatus.completed],
    OrderStatus.completed:       [],
    OrderStatus.cancelled:       [],
}

ALLOWED_ITEM_TRANSITIONS: dict[OrderItemStatus, list[OrderItemStatus]] = {
    OrderItemStatus.draft: [OrderItemStatus.confirmed, OrderItemStatus.cancelled],
    OrderItemStatus.confirmed: [OrderItemStatus.in_production, OrderItemStatus.cancelled],
    OrderItemStatus.in_production: [OrderItemStatus.ready_for_shipment, OrderItemStatus.cancelled],
    OrderItemStatus.ready_for_shipment: [OrderItemStatus.shipped],
    OrderItemStatus.shipped: [OrderItemStatus.completed],
    OrderItemStatus.completed: [],
    OrderItemStatus.cancelled: [],
}

DOOR_BLOCKING_STATUSES = {
    DoorStatus.in_production,
    DoorStatus.ready_for_shipment,
    DoorStatus.shipped,
    DoorStatus.completed,
}


# ─── Workflow ─────────────────────────────────────────────────────────────────

async def transition_order_status(
    db: AsyncSession,
    order_id: uuid.UUID,
    new_status: OrderStatus,
) -> Order:
    order = await get_order(db, order_id)

    allowed = ALLOWED_ORDER_TRANSITIONS.get(order.status, [])
    if new_status not in allowed:
        raise BadRequestException(
            f"Нельзя перейти из '{order.status.value}' в '{new_status.value}'"
        )

    # → active: bulk-confirm remaining draft items, lock prices
    if new_status == OrderStatus.active:
        if not order.items:
            raise BadRequestException("Нельзя активировать заказ без позиций")
        for item in order.items:
            if item.status == OrderItemStatus.draft:
                item.status = OrderItemStatus.confirmed
                if item.locked_price is None:
                    config = item.configuration
                    if config:
                        core_price = config.price_estimate or Decimal("0")
                        core_cost = config.cost_price or Decimal("0")
                        item.locked_price = core_price + (item.variant_price or Decimal("0"))
                        item.locked_cost = core_cost + (item.variant_cost or Decimal("0"))
        order.confirmed_at = datetime.now(timezone.utc)
        await _recalculate_total(db, order)

    # active → completed: only if all items completed or cancelled
    if new_status == OrderStatus.completed:
        active_items = [
            i for i in order.items
            if i.status not in (OrderItemStatus.completed, OrderItemStatus.cancelled)
        ]
        if active_items:
            raise BadRequestException(
                f"Нельзя завершить заказ: {len(active_items)} позиций ещё не завершены"
            )
        order.completed_at = datetime.now(timezone.utc)

    # → cancelled: BLOCKED if any door is in_production or later
    if new_status == OrderStatus.cancelled:
        blocking_doors = []
        for item in order.items:
            for door in (item.doors or []):
                if door.status in DOOR_BLOCKING_STATUSES:
                    blocking_doors.append(door.internal_number)
        if blocking_doors:
            raise BadRequestException(
                f"Нельзя отменить заказ: {len(blocking_doors)} дверей уже в производстве или далее "
                f"({', '.join(blocking_doors[:5])}{'...' if len(blocking_doors) > 5 else ''})"
            )
        for item in order.items:
            if item.status not in (OrderItemStatus.completed, OrderItemStatus.cancelled):
                item.status = OrderItemStatus.cancelled

    order.status = new_status
    await db.flush()
    return order


async def transition_item_status(
    db: AsyncSession,
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    new_status: OrderItemStatus,
) -> Order:
    order = await get_order(db, order_id)
    item = _find_item(order, item_id)

    allowed = ALLOWED_ITEM_TRANSITIONS.get(item.status, [])
    if new_status not in allowed:
        raise BadRequestException(
            f"Нельзя перейти из '{item.status.value}' в '{new_status.value}'"
        )

    # draft → confirmed: lock price
    if new_status == OrderItemStatus.confirmed:
        if item.locked_price is None:
            config = item.configuration
            if config:
                item.locked_price = config.price_estimate
                item.locked_cost = config.cost_price
        await _recalculate_total(db, order)

    # confirmed → in_production: auto-create doors + авто-перевод заказа в active
    if new_status == OrderItemStatus.in_production:
        existing_doors = list(item.doors) if item.doors else []
        if not existing_doors:
            await _generate_doors_for_item(db, item)
        order.production_started_at = order.production_started_at or datetime.now(timezone.utc)
        # Авто-активация заказа при первом запуске позиции в производство
        if order.status not in (OrderStatus.active, OrderStatus.completed, OrderStatus.cancelled):
            order.status = OrderStatus.active
            order.confirmed_at = order.confirmed_at or datetime.now(timezone.utc)

    # → cancelled: BLOCKED if any door in_production or later
    if new_status == OrderItemStatus.cancelled:
        blocking = [
            d for d in (item.doors or [])
            if d.status in DOOR_BLOCKING_STATUSES
        ]
        if blocking:
            raise BadRequestException(
                f"Нельзя отменить позицию: {len(blocking)} дверей уже в производстве или далее"
            )

    item.status = new_status
    await db.flush()
    return order
