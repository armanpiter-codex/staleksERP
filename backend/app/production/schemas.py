import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ─── Stage schemas ────────────────────────────────────────────────────────────

class ProductionStageSchema(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductionStageCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    sort_order: int = Field(0, ge=0)
    is_active: bool = True


class ProductionStageUpdateSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class ReorderStagesSchema(BaseModel):
    stage_ids: list[uuid.UUID] = Field(..., min_length=1)


# ─── Route schemas ────────────────────────────────────────────────────────────

class RouteStepSchema(BaseModel):
    """One step in a model's production route."""
    id: uuid.UUID
    stage_id: uuid.UUID
    stage_code: str
    stage_name: str
    step_order: int
    is_optional: bool
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


class ProductionRouteSchema(BaseModel):
    """Full route for a door model."""
    door_model_id: uuid.UUID
    door_model_code: str
    door_model_label: str
    steps: list[RouteStepSchema]


class RouteStepInput(BaseModel):
    stage_id: uuid.UUID
    step_order: int = Field(..., ge=1)
    is_optional: bool = False
    notes: str | None = None


class SetRouteSchema(BaseModel):
    """Bulk-set route steps for a model (replaces all existing)."""
    steps: list[RouteStepInput] = Field(default_factory=list)


# ─── Queue schemas ────────────────────────────────────────────────────────────

class ProductionDoorSchema(BaseModel):
    """Door in production queue with enriched context."""
    door_id: uuid.UUID
    internal_number: str
    marking: str | None
    priority: bool
    current_stage_id: uuid.UUID | None
    current_stage_name: str | None
    current_stage_code: str | None
    order_id: uuid.UUID
    order_number: str
    item_id: uuid.UUID
    door_model_id: uuid.UUID | None
    door_model_label: str | None
    route_total_steps: int
    route_current_step: int
    notes: str | None
    created_at: datetime


class StageCounterSchema(BaseModel):
    stage_id: uuid.UUID | None
    stage_name: str
    stage_code: str
    count: int


class ProductionQueueResponse(BaseModel):
    items: list[ProductionDoorSchema]
    total: int
    counters: list[StageCounterSchema]


# ─── Movement schemas ────────────────────────────────────────────────────────

class MoveDoorStageSchema(BaseModel):
    notes: str | None = None


class MoveDoorToStageSchema(BaseModel):
    stage_id: uuid.UUID
    notes: str | None = None


class DoorStageHistorySchema(BaseModel):
    id: uuid.UUID
    door_id: uuid.UUID
    from_stage_name: str | None
    from_stage_code: str | None
    to_stage_name: str
    to_stage_code: str
    moved_by_name: str
    notes: str | None
    moved_at: datetime


# ─── Print form schemas ──────────────────────────────────────────────────────

class PrintFieldValueSchema(BaseModel):
    field_code: str
    field_label: str
    field_value: str
    unit: str | None = None
    group_code: str
    group_label: str


class PrintFieldGroupSchema(BaseModel):
    group_code: str
    group_label: str
    fields: list[PrintFieldValueSchema]


class RouteStageForPrintSchema(BaseModel):
    stage_name: str
    step_order: int
    is_completed: bool
    is_current: bool
    is_optional: bool = False


class DoorPrintDataSchema(BaseModel):
    # Door identity
    door_id: uuid.UUID
    internal_number: str
    marking: str | None = None
    # Order info
    order_number: str
    client_name: str
    facility_name: str | None = None
    # Door location
    floor: str | None = None
    building_block: str | None = None
    apartment_number: str | None = None
    location_description: str | None = None
    # Model
    door_model_label: str | None = None
    door_type: str | None = None
    configuration_name: str | None = None
    # Configuration fields grouped
    field_groups: list[PrintFieldGroupSchema] = []
    # Variant values (resolved)
    variant_fields: list[PrintFieldValueSchema] = []
    # Production progress
    current_stage_name: str | None = None
    route_current_step: int = 0
    route_total_steps: int = 0
    route_stages: list[RouteStageForPrintSchema] = []
    # Priority & notes
    priority: bool = False
    item_notes: str | None = None
    door_notes: str | None = None
    # Metadata
    print_date: str


class StagePrintDoorSchema(BaseModel):
    internal_number: str
    marking: str | None = None
    order_number: str
    door_model_label: str | None = None
    height: str | None = None
    width: str | None = None
    priority: bool = False


class StagePrintDataSchema(BaseModel):
    stage_name: str
    stage_code: str
    print_date: str
    total_doors: int
    doors: list[StagePrintDoorSchema]
