"""Pricing — финансовая сводка заказа."""
import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.orders.models import DoorStatus, OrderItemStatus
from app.orders.schemas import ItemSummarySchema, OrderSummarySchema, ServiceLineSchema
from app.orders.services.crud import get_order
from app.services.models import BillingMethod


async def get_order_summary(
    db: AsyncSession,
    order_id: uuid.UUID,
) -> OrderSummarySchema:
    order = await get_order(db, order_id)

    subtotal = Decimal("0")
    total_doors = 0
    item_summaries = []

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
        item_total = price * item.quantity
        subtotal += item_total
        total_doors += item.quantity

        doors = list(item.doors) if item.doors else []
        item_summaries.append(ItemSummarySchema(
            item_id=item.id,
            position_number=item.position_number,
            configuration_name=config.name if config else "—",
            door_type=config.door_type.value if config else "—",
            quantity=item.quantity,
            price_per_unit=price,
            total_price=item_total,
            status=item.status,
            doors_pending=sum(1 for d in doors if d.status == DoorStatus.pending),
            doors_in_production=sum(1 for d in doors if d.status == DoorStatus.in_production),
            doors_ready=sum(1 for d in doors if d.status == DoorStatus.ready_for_shipment),
            doors_shipped=sum(1 for d in doors if d.status == DoorStatus.shipped),
            doors_completed=sum(1 for d in doors if d.status == DoorStatus.completed),
        ))

    discount_amount = Decimal("0")
    if order.discount_percent:
        discount_amount = subtotal * order.discount_percent / Decimal("100")

    # Dynamic services from order_services table
    services_total = Decimal("0")
    service_lines: list[ServiceLineSchema] = []
    for svc in (order.services or []):
        svc_price = svc.price or Decimal("0")
        service_lines.append(ServiceLineSchema(
            service_type_code=svc.service_type_code,
            service_type_name=svc.service_type_name,
            icon=svc.service_type_icon,
            price=svc_price,
            billing_method=svc.billing_method,
            billing_entity_name=svc.billing_entity_name,
        ))
        # Only 'separate' services add to total; 'included' is in door price, 'free' is 0
        if svc.billing_method == BillingMethod.separate:
            services_total += svc_price

    # Fallback: if no order_services exist, use legacy columns
    measurement = order.measurement_cost or Decimal("0")
    delivery = order.delivery_cost or Decimal("0")
    installation = order.installation_cost or Decimal("0")
    legacy_total = measurement + delivery + installation

    # Use services_total if order_services exist, otherwise legacy
    ancillaries = services_total if service_lines else legacy_total

    total_before_vat = subtotal - discount_amount + ancillaries
    vat_rate = order.vat_rate or Decimal("16")
    vat_amount = total_before_vat * vat_rate / Decimal("100")
    total_with_vat = total_before_vat + vat_amount

    outstanding = None
    if order.prepayment_amount is not None:
        outstanding = max(Decimal("0"), total_with_vat - order.prepayment_amount)

    return OrderSummarySchema(
        order_id=order.id,
        order_number=order.order_number,
        client_name=order.client_name,
        client_type=order.client_type,
        status=order.status,
        items_count=len(item_summaries),
        total_doors=total_doors,
        subtotal=subtotal,
        discount_amount=discount_amount,
        measurement_cost=measurement,
        delivery_cost=delivery,
        installation_cost=installation,
        services=service_lines,
        services_total=services_total,
        total_before_vat=total_before_vat,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_with_vat=total_with_vat,
        prepayment_amount=order.prepayment_amount,
        outstanding_amount=outstanding,
        items=item_summaries,
    )
