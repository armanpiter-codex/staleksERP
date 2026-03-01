import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ─── Workshop schemas ────────────────────────────────────────────────────────

class ProductionWorkshopSchema(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    color: str | None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkshopCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    color: str | None = Field(None, max_length=7)
    sort_order: int = Field(0, ge=0)
    is_active: bool = True


class WorkshopUpdateSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    color: str | None = Field(None, max_length=7)
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class ReorderWorkshopsSchema(BaseModel):
    workshop_ids: list[uuid.UUID] = Field(..., min_length=1)


# ─── Stage schemas ────────────────────────────────────────────────────────────

class ProductionStageSchema(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    sort_order: int
    is_active: bool
    workshop_id: uuid.UUID | None = None
    workshop_name: str | None = None
    workshop_code: str | None = None
    workshop_color: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductionStageCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    sort_order: int = Field(0, ge=0)
    is_active: bool = True
    workshop_id: uuid.UUID | None = None


class ProductionStageUpdateSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None
    workshop_id: uuid.UUID | None = None


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
    phase: int = 1
    workshop_id: uuid.UUID | None = None
    workshop_name: str | None = None
    workshop_code: str | None = None
    workshop_color: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RouteTrackSchema(BaseModel):
    """A workshop track within a phase."""
    workshop_id: uuid.UUID
    workshop_name: str
    workshop_code: str
    workshop_color: str | None = None
    steps: list[RouteStepSchema]


class RoutePhaseSchema(BaseModel):
    """A phase with parallel workshop tracks."""
    phase: int
    tracks: list[RouteTrackSchema]


class ProductionRouteSchema(BaseModel):
    """Full route for a door model (phase-grouped + flat steps)."""
    door_model_id: uuid.UUID
    door_model_code: str
    door_model_label: str
    phases: list[RoutePhaseSchema] = []
    steps: list[RouteStepSchema] = []  # flat list for backward compat


# ─── Route input schemas ─────────────────────────────────────────────────────

class RouteStepInput(BaseModel):
    stage_id: uuid.UUID
    step_order: int = Field(..., ge=1)
    is_optional: bool = False
    notes: str | None = None


class RoutePhaseInput(BaseModel):
    phase: int = Field(..., ge=1)
    workshop_id: uuid.UUID
    stages: list[RouteStepInput] = Field(..., min_length=1)


class SetRouteSchema(BaseModel):
    """Phase-based route definition (replaces all existing steps)."""
    phases: list[RoutePhaseInput] = Field(default_factory=list)


# ─── Workshop progress schemas ───────────────────────────────────────────────

class WorkshopProgressSchema(BaseModel):
    """Progress of a door within a specific workshop track."""
    workshop_id: uuid.UUID
    workshop_name: str
    workshop_code: str
    workshop_color: str | None = None
    phase: int
    current_stage_id: uuid.UUID | None = None
    current_stage_name: str | None = None
    current_stage_code: str | None = None
    status: str  # 'pending' | 'active' | 'completed' | 'skipped'
    track_total_steps: int = 0
    track_current_step: int = 0


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
    # Sprint 16: parallel tracks
    current_phase: int | None = None
    total_phases: int = 0
    workshop_progress: list[WorkshopProgressSchema] = []


class StageCounterSchema(BaseModel):
    stage_id: uuid.UUID | None
    stage_name: str
    stage_code: str
    count: int
    workshop_id: uuid.UUID | None = None
    workshop_name: str | None = None
    workshop_code: str | None = None
    workshop_color: str | None = None


class WorkshopCounterSchema(BaseModel):
    workshop_id: uuid.UUID | None
    workshop_name: str
    workshop_code: str
    workshop_color: str | None = None
    count: int
    stages: list[StageCounterSchema] = []


class ProductionQueueResponse(BaseModel):
    items: list[ProductionDoorSchema]
    total: int
    counters: list[StageCounterSchema]
    workshop_counters: list[WorkshopCounterSchema] = []


# ─── Movement schemas ────────────────────────────────────────────────────────

class MoveDoorStageSchema(BaseModel):
    workshop_id: uuid.UUID | None = None
    notes: str | None = None


class MoveDoorToStageSchema(BaseModel):
    stage_id: uuid.UUID
    workshop_id: uuid.UUID | None = None
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
    workshop_name: str | None = None
    workshop_color: str | None = None
    phase: int = 1


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
    workshop_name: str | None = None
    print_date: str
    total_doors: int
    doors: list[StagePrintDoorSchema]


# ─── Launch Check schemas (Sprint 17) ────────────────────────────────────────

class LaunchCheckDefinitionSchema(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None
    is_required: bool
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LaunchCheckDefinitionCreateSchema(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    is_required: bool = True
    sort_order: int = Field(0, ge=0)
    is_active: bool = True


class LaunchCheckDefinitionUpdateSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    is_required: bool | None = None
    sort_order: int | None = Field(None, ge=0)
    is_active: bool | None = None


class ReorderLaunchChecksSchema(BaseModel):
    check_ids: list[uuid.UUID] = Field(..., min_length=1)


class DoorLaunchCheckSchema(BaseModel):
    id: uuid.UUID
    door_id: uuid.UUID
    check_id: uuid.UUID
    check_name: str
    check_description: str | None
    is_required: bool
    sort_order: int
    is_done: bool
    done_by: uuid.UUID | None
    done_at: datetime | None
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


class DoorLaunchCheckUpdateSchema(BaseModel):
    is_done: bool
    notes: str | None = None


class PendingDoorCheckStatusSchema(BaseModel):
    check_id: uuid.UUID
    check_code: str
    check_name: str
    is_done: bool


class PendingDoorSchema(BaseModel):
    id: uuid.UUID
    internal_number: str
    marking: str | None
    order_id: uuid.UUID
    order_number: str
    item_id: uuid.UUID
    door_model_id: uuid.UUID | None
    door_model_label: str | None
    client_name: str | None
    facility_name: str | None
    floor: str | None
    building_block: str | None
    apartment: str | None
    priority: bool
    checks_total: int
    checks_done: int
    is_ready: bool  # all required checks done
    check_statuses: list[PendingDoorCheckStatusSchema] = []

    model_config = ConfigDict(from_attributes=True)


class BatchLaunchSchema(BaseModel):
    door_ids: list[uuid.UUID] = Field(..., min_length=1)


# ─── Overdue schemas (Sprint 18) ─────────────────────────────────────────────

class OverdueDoorSchema(BaseModel):
    door_id: uuid.UUID
    internal_number: str
    marking: str | None
    order_id: uuid.UUID
    order_number: str
    client_name: str | None
    door_model_id: uuid.UUID | None
    door_model_label: str | None
    current_stage_id: uuid.UUID | None
    current_stage_name: str | None
    current_stage_code: str | None
    deadline: datetime
    days_overdue: int
    route_total_steps: int
    route_current_step: int
    workshop_progress: list[WorkshopProgressSchema] = []


class OverdueQueueResponse(BaseModel):
    items: list[OverdueDoorSchema]
    total: int
