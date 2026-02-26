import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.configurator.models import (
    ConfigurationStatus,
    DoorType,
    FieldLayer,
    FieldType,
    MarkingStatus,
    VisibilityRuleType,
)


# ─── Door Models ─────────────────────────────────────────────────────────────

class DoorModelSchema(BaseModel):
    id: uuid.UUID
    code: str
    label: str
    label_short: str | None
    door_type: DoorType
    sort_order: int
    is_active: bool
    no_exterior: bool
    notes: str | None

    model_config = {"from_attributes": True}


class DoorModelCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(..., min_length=1, max_length=200)
    label_short: str | None = Field(None, max_length=100)
    door_type: DoorType
    sort_order: int = Field(0, ge=0)
    is_active: bool = True
    no_exterior: bool = False
    notes: str | None = None


class DoorModelUpdateSchema(BaseModel):
    label: str | None = None
    label_short: str | None = None
    door_type: DoorType | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    no_exterior: bool | None = None
    notes: str | None = None


# ─── Door Field Groups ───────────────────────────────────────────────────────

class DoorFieldGroupSchema(BaseModel):
    id: uuid.UUID
    code: str
    label: str
    sort_order: int
    is_active: bool
    door_type_applicability: list[str]
    notes: str | None

    model_config = {"from_attributes": True}

    @field_validator("door_type_applicability", mode="before")
    @classmethod
    def parse_applicability(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            return v
        return ["technical", "finish"]


class DoorFieldGroupCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(..., min_length=1, max_length=200)
    sort_order: int = Field(0, ge=0)
    is_active: bool = True
    door_type_applicability: list[str] = ["technical", "finish"]
    notes: str | None = None


class DoorFieldGroupUpdateSchema(BaseModel):
    label: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    door_type_applicability: list[str] | None = None
    notes: str | None = None


# ─── Field Definitions ────────────────────────────────────────────────────────

class FieldOptionSchema(BaseModel):
    value: str
    label: str


class DoorFieldDefinitionSchema(BaseModel):
    id: uuid.UUID
    code: str
    label: str
    label_short: str | None
    field_type: FieldType
    group_code: str
    group_label: str
    sort_order: int
    options: list[FieldOptionSchema] | None = None
    default_value: str | None
    is_required: bool
    door_type_applicability: list[str]
    layer: str  # "core" | "variant"
    unit: str | None
    notes: str | None
    is_active: bool
    is_display: bool
    display_order: int | None

    model_config = {"from_attributes": True}

    @field_validator("options", mode="before")
    @classmethod
    def parse_options(cls, v: Any) -> list[FieldOptionSchema] | None:
        if v is None:
            return None
        if isinstance(v, list):
            return [FieldOptionSchema(**item) if isinstance(item, dict) else item for item in v]
        return v

    @field_validator("door_type_applicability", mode="before")
    @classmethod
    def parse_applicability(cls, v: Any) -> list[str]:
        if isinstance(v, list):
            return v
        return ["technical", "finish"]


class DoorFieldDefinitionCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(..., min_length=1, max_length=200)
    label_short: str | None = Field(None, max_length=100)
    field_type: FieldType
    group_code: str = Field(..., min_length=1, max_length=100)
    group_label: str = Field(..., min_length=1, max_length=200)
    sort_order: int = Field(0, ge=0)
    options: list[FieldOptionSchema] | None = None
    default_value: str | None = None
    is_required: bool = False
    door_type_applicability: list[str] = ["technical", "finish"]
    layer: FieldLayer = FieldLayer.core
    unit: str | None = None
    notes: str | None = None
    is_display: bool = True
    display_order: int | None = None


class DoorFieldDefinitionUpdateSchema(BaseModel):
    label: str | None = None
    label_short: str | None = None
    group_code: str | None = None
    group_label: str | None = None
    sort_order: int | None = None
    options: list[FieldOptionSchema] | None = None
    default_value: str | None = None
    is_required: bool | None = None
    door_type_applicability: list[str] | None = None
    layer: FieldLayer | None = None
    unit: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    is_display: bool | None = None
    display_order: int | None = None


# ─── Visibility Rules ─────────────────────────────────────────────────────────

class VisibilityRuleSchema(BaseModel):
    id: uuid.UUID
    field_code: str
    depends_on_field_code: str
    depends_on_value: Any  # Может быть строкой или списком строк
    rule_type: VisibilityRuleType

    model_config = {"from_attributes": True}


class VisibilityRuleCreateSchema(BaseModel):
    field_code: str
    depends_on_field_code: str
    depends_on_value: Any  # Строка или список строк
    rule_type: VisibilityRuleType = VisibilityRuleType.show_when


# ─── Markings ─────────────────────────────────────────────────────────────────

class DoorMarkingSchema(BaseModel):
    id: uuid.UUID
    configuration_id: uuid.UUID
    marking: str
    floor: str | None
    building_block: str | None = None
    apartment_number: str | None = None
    location_description: str | None
    status: MarkingStatus
    qr_code: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DoorMarkingCreateSchema(BaseModel):
    marking: str = Field(..., min_length=1, max_length=50)
    floor: str | None = Field(None, max_length=50)
    building_block: str | None = Field(None, max_length=100)
    apartment_number: str | None = Field(None, max_length=50)
    location_description: str | None = Field(None, max_length=300)
    notes: str | None = None


class DoorMarkingUpdateSchema(BaseModel):
    floor: str | None = None
    building_block: str | None = None
    apartment_number: str | None = None
    location_description: str | None = None
    status: MarkingStatus | None = None
    notes: str | None = None


class GenerateMarkingsSchema(BaseModel):
    """Автогенерация маркировок для конфигурации."""
    prefix: str = Field(..., min_length=1, max_length=10)  # напр. "Д3"
    start_number: int = Field(1, ge=1)
    count: int = Field(..., ge=1, le=500)
    zero_pad: int = Field(3, ge=1, le=5)  # Количество нулей в номере


class BulkMarkingImportRow(BaseModel):
    marking: str
    floor: str | None = None
    building_block: str | None = None
    apartment_number: str | None = None
    location_description: str | None = None


class BulkMarkingsImportSchema(BaseModel):
    markings: list[BulkMarkingImportRow] = Field(..., min_length=1, max_length=500)


# ─── BOM (Bill of Materials) ──────────────────────────────────────────────────

class BOMLineSchema(BaseModel):
    material_name: str
    material_code: str | None
    unit: str
    quantity_per_door: float
    quantity_total: float  # × количество дверей в конфигурации


class BOMSchema(BaseModel):
    configuration_id: uuid.UUID
    door_quantity: int
    lines: list[BOMLineSchema]


# ─── Pricing ──────────────────────────────────────────────────────────────────

class PriceBreakdownLineSchema(BaseModel):
    field_code: str
    field_label: str
    field_value: str
    price_component: Decimal
    cost_component: Decimal


class PriceCalculationSchema(BaseModel):
    configuration_id: uuid.UUID
    door_quantity: int
    price_per_door: Decimal
    cost_per_door: Decimal
    price_total: Decimal
    cost_total: Decimal
    margin_percent: float | None
    breakdown: list[PriceBreakdownLineSchema]


class PricingRuleSchema(BaseModel):
    id: uuid.UUID
    field_code: str
    field_value: str
    price_component: Decimal
    cost_component: Decimal
    effective_from: datetime | None
    effective_to: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}


class PricingRuleCreateSchema(BaseModel):
    field_code: str
    field_value: str
    price_component: Decimal = Field(Decimal("0"), ge=0)
    cost_component: Decimal = Field(Decimal("0"), ge=0)
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    notes: str | None = None


class PricingRuleUpdateSchema(BaseModel):
    price_component: Decimal | None = None
    cost_component: Decimal | None = None
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    notes: str | None = None


# ─── Material Norms ───────────────────────────────────────────────────────────

class MaterialNormSchema(BaseModel):
    id: uuid.UUID
    field_code: str
    field_value: str
    material_name: str
    material_code: str | None
    unit: str
    quantity_formula: str
    notes: str | None

    model_config = {"from_attributes": True}


class MaterialNormCreateSchema(BaseModel):
    field_code: str
    field_value: str
    material_name: str = Field(..., min_length=1, max_length=200)
    material_code: str | None = Field(None, max_length=100)
    unit: str = Field(..., min_length=1, max_length=20)
    quantity_formula: str = Field(..., min_length=1)
    notes: str | None = None


# ─── Door Configurations ──────────────────────────────────────────────────────

class DoorConfigurationSchema(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID | None
    door_type: DoorType
    name: str
    quantity: int
    values: dict[str, Any]
    price_estimate: Decimal | None
    cost_price: Decimal | None
    locked_price: Decimal | None = None
    locked_cost: Decimal | None = None
    is_template: bool = False
    status: ConfigurationStatus
    notes: str | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    markings: list[DoorMarkingSchema] = []

    model_config = {"from_attributes": True}


class DoorConfigurationCreateSchema(BaseModel):
    door_type: DoorType
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(1, ge=1, le=9999)
    values: dict[str, Any] = Field(default_factory=dict)
    is_template: bool = False
    notes: str | None = None
    order_id: uuid.UUID | None = None


class DoorConfigurationUpdateSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    quantity: int | None = Field(None, ge=1, le=9999)
    values: dict[str, Any] | None = None
    status: ConfigurationStatus | None = None
    notes: str | None = None


# ─── Combined catalog (fields + rules for frontend) ───────────────────────────

class ConfiguratorCatalogSchema(BaseModel):
    """Всё что нужно фронтенду для работы с конфигуратором."""
    field_definitions: list[DoorFieldDefinitionSchema]
    visibility_rules: list[VisibilityRuleSchema]
    groups: list[DoorFieldGroupSchema]
    models: list[DoorModelSchema] = []
