"""Pricing service — price calculation engine."""
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.configurator.models import DoorFieldDefinition, PricingRule
from app.configurator.schemas import PriceBreakdownLineSchema, PriceCalculationSchema
from app.configurator.services.configurations import get_configuration


async def calculate_price(
    db: AsyncSession, config_id: uuid.UUID
) -> PriceCalculationSchema:
    """Подробный расчёт цены с breakdown по полям."""
    config = await get_configuration(db, config_id)

    field_codes = list(config.values.keys())
    result = await db.execute(
        select(PricingRule).where(PricingRule.field_code.in_(field_codes))
    )
    all_rules = result.scalars().all()
    rules_index: dict[str, dict[str, PricingRule]] = {}
    for rule in all_rules:
        rules_index.setdefault(rule.field_code, {})[rule.field_value] = rule

    fields_result = await db.execute(
        select(DoorFieldDefinition).where(DoorFieldDefinition.code.in_(field_codes))
    )
    fields_map: dict[str, DoorFieldDefinition] = {
        f.code: f for f in fields_result.scalars().all()
    }

    breakdown: list[PriceBreakdownLineSchema] = []
    price_per_door = Decimal("0")
    cost_per_door = Decimal("0")

    for field_code, field_value in config.values.items():
        if field_code in rules_index:
            rule = rules_index[field_code].get(str(field_value))
            if rule and (rule.price_component or rule.cost_component):
                field_label = fields_map[field_code].label if field_code in fields_map else field_code
                breakdown.append(PriceBreakdownLineSchema(
                    field_code=field_code,
                    field_label=field_label,
                    field_value=str(field_value),
                    price_component=rule.price_component,
                    cost_component=rule.cost_component,
                ))
                price_per_door += rule.price_component
                cost_per_door += rule.cost_component

    price_total = price_per_door * config.quantity
    cost_total = cost_per_door * config.quantity
    margin = None
    if price_total > 0 and cost_total >= 0:
        margin = float((price_total - cost_total) / price_total * 100)

    return PriceCalculationSchema(
        configuration_id=config.id,
        door_quantity=config.quantity,
        price_per_door=price_per_door,
        cost_per_door=cost_per_door,
        price_total=price_total,
        cost_total=cost_total,
        margin_percent=margin,
        breakdown=breakdown,
    )


async def calculate_variant_price(
    db: AsyncSession, variant_values: dict[str, Any]
) -> tuple[Decimal, Decimal]:
    """Рассчитывает стоимость надстройки (variant) по PricingRules.

    Returns:
        (variant_price, variant_cost)
    """
    if not variant_values:
        return Decimal("0"), Decimal("0")

    field_codes = list(variant_values.keys())
    result = await db.execute(
        select(PricingRule).where(PricingRule.field_code.in_(field_codes))
    )
    all_rules = result.scalars().all()

    rules_index: dict[str, dict[str, PricingRule]] = {}
    for rule in all_rules:
        rules_index.setdefault(rule.field_code, {})[rule.field_value] = rule

    price_total = Decimal("0")
    cost_total = Decimal("0")

    for field_code, field_value in variant_values.items():
        if field_code in rules_index:
            rule = rules_index[field_code].get(str(field_value))
            if rule:
                price_total += rule.price_component
                cost_total += rule.cost_component

    return price_total, cost_total
