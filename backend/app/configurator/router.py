"""Configurator router — все API эндпоинты конфигуратора дверей."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_permission
from app.auth.models import User
from app.auth.schemas import TokenPayload
from app.database import get_db
from app.configurator import service
from app.configurator.models import ConfigurationStatus, DoorType
from app.configurator.schemas import (
    BOMSchema,
    BulkMarkingsImportSchema,
    ConfiguratorCatalogSchema,
    DoorConfigurationCreateSchema,
    DoorConfigurationSchema,
    DoorConfigurationUpdateSchema,
    DoorFieldDefinitionCreateSchema,
    DoorFieldDefinitionSchema,
    DoorFieldDefinitionUpdateSchema,
    DoorFieldGroupCreateSchema,
    DoorFieldGroupSchema,
    DoorFieldGroupUpdateSchema,
    DoorMarkingCreateSchema,
    DoorMarkingSchema,
    DoorMarkingUpdateSchema,
    DoorModelCreateSchema,
    DoorModelSchema,
    DoorModelUpdateSchema,
    GenerateMarkingsSchema,
    MaterialNormCreateSchema,
    MaterialNormSchema,
    PriceCalculationSchema,
    PricingRuleCreateSchema,
    PricingRuleSchema,
    PricingRuleUpdateSchema,
    VisibilityRuleCreateSchema,
    VisibilityRuleSchema,
)

router = APIRouter(prefix="/configurator", tags=["configurator"])


# ─── Catalog (fields + rules) ──────────────────────────────────────────────────

@router.get(
    "/catalog",
    response_model=ConfiguratorCatalogSchema,
    summary="Получить каталог полей и правил видимости",
)
async def get_catalog(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:view")),
) -> ConfiguratorCatalogSchema:
    """Загружает все активные поля конфигуратора + правила видимости.
    Вызывается один раз при открытии страницы конфигуратора.
    """
    return await service.get_configurator_catalog(db)


# ─── Door Models ──────────────────────────────────────────────────────────────

@router.get(
    "/models",
    response_model=list[DoorModelSchema],
    summary="Список моделей дверей",
)
async def list_models(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> list[DoorModelSchema]:
    models = await service.get_all_models(db, active_only=active_only)
    return [DoorModelSchema.model_validate(m) for m in models]


@router.post(
    "/models",
    response_model=DoorModelSchema,
    status_code=201,
    summary="Создать модель двери",
)
async def create_model(
    data: DoorModelCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorModelSchema:
    obj = await service.create_model(db, data.model_dump())
    await db.commit()
    return DoorModelSchema.model_validate(obj)


@router.get(
    "/models/{code}",
    response_model=DoorModelSchema,
    summary="Получить модель по коду",
)
async def get_model(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorModelSchema:
    obj = await service.get_model_by_code(db, code)
    return DoorModelSchema.model_validate(obj)


@router.patch(
    "/models/{code}",
    response_model=DoorModelSchema,
    summary="Обновить модель двери",
)
async def update_model(
    code: str,
    data: DoorModelUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorModelSchema:
    obj = await service.update_model(db, code, data.model_dump(exclude_none=True))
    await db.commit()
    return DoorModelSchema.model_validate(obj)


@router.delete(
    "/models/{code}",
    status_code=204,
    summary="Удалить модель двери",
)
async def delete_model(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> None:
    await service.delete_model(db, code)
    await db.commit()


# ─── Door Field Groups ───────────────────────────────────────────────────────

@router.get(
    "/groups",
    response_model=list[DoorFieldGroupSchema],
    summary="Список секций/групп полей",
)
async def list_groups(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> list[DoorFieldGroupSchema]:
    groups = await service.get_all_groups(db, active_only=active_only)
    return [DoorFieldGroupSchema.model_validate(g) for g in groups]


@router.post(
    "/groups",
    response_model=DoorFieldGroupSchema,
    status_code=201,
    summary="Создать секцию полей",
)
async def create_group(
    data: DoorFieldGroupCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorFieldGroupSchema:
    obj = await service.create_group(db, data.model_dump())
    await db.commit()
    return DoorFieldGroupSchema.model_validate(obj)


@router.get(
    "/groups/{code}",
    response_model=DoorFieldGroupSchema,
    summary="Получить секцию по коду",
)
async def get_group(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorFieldGroupSchema:
    obj = await service.get_group_by_code(db, code)
    return DoorFieldGroupSchema.model_validate(obj)


@router.patch(
    "/groups/{code}",
    response_model=DoorFieldGroupSchema,
    summary="Обновить секцию полей",
)
async def update_group(
    code: str,
    data: DoorFieldGroupUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorFieldGroupSchema:
    obj = await service.update_group(db, code, data.model_dump(exclude_none=True))
    await db.commit()
    return DoorFieldGroupSchema.model_validate(obj)


@router.delete(
    "/groups/{code}",
    status_code=204,
    summary="Удалить секцию полей",
)
async def delete_group(
    code: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> None:
    await service.delete_group(db, code)
    await db.commit()


# ─── Field Definitions ─────────────────────────────────────────────────────────

@router.get(
    "/fields",
    response_model=list[DoorFieldDefinitionSchema],
    summary="Список всех полей конфигуратора",
)
async def list_fields(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> list[DoorFieldDefinitionSchema]:
    fields = await service.get_all_field_definitions(db, active_only=active_only)
    return [DoorFieldDefinitionSchema.model_validate(f) for f in fields]


@router.post(
    "/fields",
    response_model=DoorFieldDefinitionSchema,
    status_code=201,
    summary="Создать новое поле конфигуратора",
)
async def create_field(
    data: DoorFieldDefinitionCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorFieldDefinitionSchema:
    obj = await service.create_field_definition(db, data.model_dump())
    await db.commit()
    return DoorFieldDefinitionSchema.model_validate(obj)


@router.patch(
    "/fields/{code}",
    response_model=DoorFieldDefinitionSchema,
    summary="Обновить поле конфигуратора",
)
async def update_field(
    code: str,
    data: DoorFieldDefinitionUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> DoorFieldDefinitionSchema:
    obj = await service.update_field_definition(db, code, data.model_dump(exclude_none=True))
    await db.commit()
    return DoorFieldDefinitionSchema.model_validate(obj)


# ─── Visibility Rules ──────────────────────────────────────────────────────────

@router.get(
    "/visibility-rules",
    response_model=list[VisibilityRuleSchema],
    summary="Список правил видимости полей",
)
async def list_visibility_rules(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> list[VisibilityRuleSchema]:
    rules = await service.get_visibility_rules(db)
    return [VisibilityRuleSchema.model_validate(r) for r in rules]


@router.post(
    "/visibility-rules",
    response_model=VisibilityRuleSchema,
    status_code=201,
    summary="Создать правило видимости поля",
)
async def create_visibility_rule(
    data: VisibilityRuleCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> VisibilityRuleSchema:
    obj = await service.create_visibility_rule(db, data)
    await db.commit()
    return VisibilityRuleSchema.model_validate(obj)


@router.delete(
    "/visibility-rules/{rule_id}",
    status_code=204,
    summary="Удалить правило видимости",
)
async def delete_visibility_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> None:
    await service.delete_visibility_rule(db, rule_id)
    await db.commit()


# ─── Configurations ────────────────────────────────────────────────────────────

@router.get(
    "/configurations",
    response_model=list[DoorConfigurationSchema],
    summary="Список конфигураций дверей",
)
async def list_configurations(
    order_id: uuid.UUID | None = Query(None),
    status: ConfigurationStatus | None = Query(None),
    door_type: DoorType | None = Query(None),
    is_template: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:view")),
) -> list[DoorConfigurationSchema]:
    configs = await service.get_configurations(
        db, order_id=order_id, status=status, door_type=door_type,
        is_template=is_template, skip=skip, limit=limit,
    )
    return [DoorConfigurationSchema.model_validate(c) for c in configs]


@router.post(
    "/configurations",
    response_model=DoorConfigurationSchema,
    status_code=201,
    summary="Создать конфигурацию двери",
)
async def create_configuration(
    data: DoorConfigurationCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_permission("configurator:create")),
) -> DoorConfigurationSchema:
    obj = await service.create_configuration(db, data, uuid.UUID(current_user.sub))
    await db.commit()
    obj = await service.get_configuration(db, obj.id)
    return DoorConfigurationSchema.model_validate(obj)


@router.get(
    "/configurations/{config_id}",
    response_model=DoorConfigurationSchema,
    summary="Получить конфигурацию по ID",
)
async def get_configuration(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:view")),
) -> DoorConfigurationSchema:
    obj = await service.get_configuration(db, config_id)
    return DoorConfigurationSchema.model_validate(obj)


@router.patch(
    "/configurations/{config_id}",
    response_model=DoorConfigurationSchema,
    summary="Обновить конфигурацию",
)
async def update_configuration(
    config_id: uuid.UUID,
    data: DoorConfigurationUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> DoorConfigurationSchema:
    await service.update_configuration(db, config_id, data)
    await db.commit()
    obj = await service.get_configuration(db, config_id)
    return DoorConfigurationSchema.model_validate(obj)


@router.post(
    "/configurations/{config_id}/duplicate",
    response_model=DoorConfigurationSchema,
    status_code=201,
    summary="Дублировать конфигурацию (копия без привязки к заказу)",
)
async def duplicate_configuration(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(require_permission("configurator:create")),
) -> DoorConfigurationSchema:
    obj = await service.duplicate_configuration(db, config_id, uuid.UUID(current_user.sub))
    await db.commit()
    obj = await service.get_configuration(db, obj.id)
    return DoorConfigurationSchema.model_validate(obj)


@router.delete(
    "/configurations/{config_id}",
    status_code=204,
    summary="Удалить конфигурацию (только draft)",
)
async def delete_configuration(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> None:
    await service.delete_configuration(db, config_id)
    await db.commit()


# ─── Price Calculation ─────────────────────────────────────────────────────────

@router.get(
    "/configurations/{config_id}/price",
    response_model=PriceCalculationSchema,
    summary="Расчёт цены и себестоимости конфигурации",
)
async def get_price_calculation(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:view")),
) -> PriceCalculationSchema:
    return await service.calculate_price(db, config_id)


# ─── BOM ──────────────────────────────────────────────────────────────────────

@router.get(
    "/configurations/{config_id}/bom",
    response_model=BOMSchema,
    summary="Расчёт BOM (расход материалов) конфигурации",
)
async def get_bom(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:view")),
) -> BOMSchema:
    return await service.calculate_bom(db, config_id)


# ─── Markings ──────────────────────────────────────────────────────────────────

@router.get(
    "/configurations/{config_id}/markings",
    response_model=list[DoorMarkingSchema],
    summary="Список маркировок конфигурации",
)
async def list_markings(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:view")),
) -> list[DoorMarkingSchema]:
    markings = await service.get_markings(db, config_id)
    return [DoorMarkingSchema.model_validate(m) for m in markings]


@router.post(
    "/configurations/{config_id}/markings",
    response_model=DoorMarkingSchema,
    status_code=201,
    summary="Добавить маркировку к конфигурации",
)
async def create_marking(
    config_id: uuid.UUID,
    data: DoorMarkingCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> DoorMarkingSchema:
    obj = await service.create_marking(db, config_id, data)
    await db.commit()
    return DoorMarkingSchema.model_validate(obj)


@router.post(
    "/configurations/{config_id}/markings/generate",
    response_model=list[DoorMarkingSchema],
    status_code=201,
    summary="Автогенерация маркировок",
)
async def generate_markings(
    config_id: uuid.UUID,
    data: GenerateMarkingsSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> list[DoorMarkingSchema]:
    markings = await service.generate_markings(db, config_id, data)
    await db.commit()
    return [DoorMarkingSchema.model_validate(m) for m in markings]


@router.post(
    "/configurations/{config_id}/markings/bulk-import",
    response_model=list[DoorMarkingSchema],
    status_code=201,
    summary="Массовый импорт маркировок из спецификации",
)
async def bulk_import_markings(
    config_id: uuid.UUID,
    data: BulkMarkingsImportSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> list[DoorMarkingSchema]:
    markings = await service.bulk_import_markings(db, config_id, data)
    await db.commit()
    return [DoorMarkingSchema.model_validate(m) for m in markings]


@router.delete(
    "/configurations/{config_id}/markings",
    status_code=204,
    summary="Удалить все маркировки конфигурации",
)
async def clear_markings(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> None:
    await service.clear_markings(db, config_id)
    await db.commit()


@router.patch(
    "/markings/{marking_id}",
    response_model=DoorMarkingSchema,
    summary="Обновить маркировку",
)
async def update_marking(
    marking_id: uuid.UUID,
    data: DoorMarkingUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> DoorMarkingSchema:
    obj = await service.update_marking(db, marking_id, data)
    await db.commit()
    return DoorMarkingSchema.model_validate(obj)


@router.delete(
    "/markings/{marking_id}",
    status_code=204,
    summary="Удалить маркировку",
)
async def delete_marking(
    marking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:edit")),
) -> None:
    await service.delete_marking(db, marking_id)
    await db.commit()


# ─── Pricing Rules ─────────────────────────────────────────────────────────────

@router.get(
    "/pricing-rules",
    response_model=list[PricingRuleSchema],
    summary="Таблица цен конфигуратора",
)
async def list_pricing_rules(
    field_code: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> list[PricingRuleSchema]:
    rules = await service.get_pricing_rules(db, field_code=field_code)
    return [PricingRuleSchema.model_validate(r) for r in rules]


@router.post(
    "/pricing-rules",
    response_model=PricingRuleSchema,
    status_code=201,
    summary="Добавить правило ценообразования",
)
async def create_pricing_rule(
    data: PricingRuleCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> PricingRuleSchema:
    obj = await service.create_pricing_rule(db, data)
    await db.commit()
    return PricingRuleSchema.model_validate(obj)


@router.patch(
    "/pricing-rules/{rule_id}",
    response_model=PricingRuleSchema,
    summary="Обновить правило ценообразования",
)
async def update_pricing_rule(
    rule_id: uuid.UUID,
    data: PricingRuleUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> PricingRuleSchema:
    obj = await service.update_pricing_rule(db, rule_id, data)
    await db.commit()
    return PricingRuleSchema.model_validate(obj)


@router.delete(
    "/pricing-rules/{rule_id}",
    status_code=204,
    summary="Удалить правило ценообразования",
)
async def delete_pricing_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> None:
    await service.delete_pricing_rule(db, rule_id)
    await db.commit()


# ─── Material Norms ────────────────────────────────────────────────────────────

@router.get(
    "/material-norms",
    response_model=list[MaterialNormSchema],
    summary="Нормы расхода материалов",
)
async def list_material_norms(
    field_code: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> list[MaterialNormSchema]:
    norms = await service.get_material_norms(db, field_code=field_code)
    return [MaterialNormSchema.model_validate(n) for n in norms]


@router.post(
    "/material-norms",
    response_model=MaterialNormSchema,
    status_code=201,
    summary="Добавить норму расхода материала",
)
async def create_material_norm(
    data: MaterialNormCreateSchema,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> MaterialNormSchema:
    obj = await service.create_material_norm(db, data)
    await db.commit()
    return MaterialNormSchema.model_validate(obj)


@router.delete(
    "/material-norms/{norm_id}",
    status_code=204,
    summary="Удалить норму расхода",
)
async def delete_material_norm(
    norm_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("configurator:admin")),
) -> None:
    await service.delete_material_norm(db, norm_id)
    await db.commit()
