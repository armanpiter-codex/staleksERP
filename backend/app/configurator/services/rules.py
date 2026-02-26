"""Rules service — pricing rules and material norms CRUD."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import NotFoundException
from app.configurator.models import MaterialNorm, PricingRule
from app.configurator.schemas import (
    MaterialNormCreateSchema,
    PricingRuleCreateSchema,
    PricingRuleUpdateSchema,
)
from app.configurator.services.bom import safe_eval_formula
from app.configurator.services.catalog import get_field_definition_by_code


# ─── Pricing Rules ────────────────────────────────────────────────────────────

async def get_pricing_rules(
    db: AsyncSession, field_code: str | None = None
) -> list[PricingRule]:
    q = select(PricingRule).order_by(PricingRule.field_code, PricingRule.field_value)
    if field_code:
        q = q.where(PricingRule.field_code == field_code)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_pricing_rule(
    db: AsyncSession, data: PricingRuleCreateSchema
) -> PricingRule:
    await get_field_definition_by_code(db, data.field_code)
    obj = PricingRule(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def update_pricing_rule(
    db: AsyncSession, rule_id: uuid.UUID, data: PricingRuleUpdateSchema
) -> PricingRule:
    result = await db.execute(select(PricingRule).where(PricingRule.id == rule_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Правило ценообразования {rule_id} не найдено")
    update_data = data.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_pricing_rule(db: AsyncSession, rule_id: uuid.UUID) -> None:
    result = await db.execute(select(PricingRule).where(PricingRule.id == rule_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Правило ценообразования {rule_id} не найдено")
    await db.delete(obj)


# ─── Material Norms ───────────────────────────────────────────────────────────

async def get_material_norms(
    db: AsyncSession, field_code: str | None = None
) -> list[MaterialNorm]:
    q = select(MaterialNorm).order_by(MaterialNorm.field_code, MaterialNorm.field_value)
    if field_code:
        q = q.where(MaterialNorm.field_code == field_code)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_material_norm(
    db: AsyncSession, data: MaterialNormCreateSchema
) -> MaterialNorm:
    await get_field_definition_by_code(db, data.field_code)
    safe_eval_formula(data.quantity_formula, 2050, 860, 1)  # validate formula
    obj = MaterialNorm(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def delete_material_norm(db: AsyncSession, norm_id: uuid.UUID) -> None:
    result = await db.execute(select(MaterialNorm).where(MaterialNorm.id == norm_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundException(f"Норма расхода {norm_id} не найдена")
    await db.delete(obj)
