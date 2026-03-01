// ─── Production Workshop ─────────────────────────────────────────────────────

export interface ProductionWorkshop {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionWorkshopCreate {
  code: string;
  name: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface ProductionWorkshopUpdate {
  name?: string | null;
  description?: string | null;
  color?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

// ─── Production Stage ────────────────────────────────────────────────────────

export interface ProductionStage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  workshop_id: string | null;
  workshop_name: string | null;
  workshop_code: string | null;
  workshop_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionStageCreate {
  code: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
  workshop_id?: string | null;
}

export interface ProductionStageUpdate {
  name?: string | null;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  workshop_id?: string | null;
}

// ─── Production Route ────────────────────────────────────────────────────────

export interface RouteStep {
  id: string;
  stage_id: string;
  stage_code: string;
  stage_name: string;
  step_order: number;
  is_optional: boolean;
  notes: string | null;
  phase: number;
  workshop_id: string | null;
  workshop_name: string | null;
  workshop_code: string | null;
  workshop_color: string | null;
}

export interface RouteTrack {
  workshop_id: string;
  workshop_name: string;
  workshop_code: string;
  workshop_color: string | null;
  steps: RouteStep[];
}

export interface RoutePhase {
  phase: number;
  tracks: RouteTrack[];
}

export interface ProductionRoute {
  door_model_id: string;
  door_model_code: string;
  door_model_label: string;
  phases: RoutePhase[];
  steps: RouteStep[]; // flat list for backward compat
}

export interface RouteStepInput {
  stage_id: string;
  step_order: number;
  is_optional?: boolean;
  notes?: string | null;
}

export interface RoutePhaseInput {
  phase: number;
  workshop_id: string;
  stages: RouteStepInput[];
}

export interface SetRoutePayload {
  phases: RoutePhaseInput[];
}

// ─── Workshop Progress ──────────────────────────────────────────────────────

export interface WorkshopProgress {
  workshop_id: string;
  workshop_name: string;
  workshop_code: string;
  workshop_color: string | null;
  phase: number;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_code: string | null;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  track_total_steps: number;
  track_current_step: number;
}

// ─── Production Queue ────────────────────────────────────────────────────────

export interface ProductionDoor {
  door_id: string;
  internal_number: string;
  marking: string | null;
  priority: boolean;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_code: string | null;
  order_id: string;
  order_number: string;
  item_id: string;
  door_model_id: string | null;
  door_model_label: string | null;
  route_total_steps: number;
  route_current_step: number;
  notes: string | null;
  created_at: string;
  // Sprint 16: parallel tracks
  current_phase: number | null;
  total_phases: number;
  workshop_progress: WorkshopProgress[];
}

export interface StageCounter {
  stage_id: string | null;
  stage_name: string;
  stage_code: string;
  count: number;
  workshop_id: string | null;
  workshop_name: string | null;
  workshop_code: string | null;
  workshop_color: string | null;
}

export interface WorkshopCounter {
  workshop_id: string | null;
  workshop_name: string;
  workshop_code: string;
  workshop_color: string | null;
  count: number;
  stages: StageCounter[];
}

export interface ProductionQueueResponse {
  items: ProductionDoor[];
  total: number;
  counters: StageCounter[];
  workshop_counters: WorkshopCounter[];
}

// ─── Door Movement ──────────────────────────────────────────────────────────

export interface MoveDoorPayload {
  workshop_id?: string | null;
  notes?: string | null;
}

export interface MoveDoorToStagePayload {
  stage_id: string;
  workshop_id?: string | null;
  notes?: string | null;
}

export interface DoorStageHistory {
  id: string;
  door_id: string;
  from_stage_name: string | null;
  from_stage_code: string | null;
  to_stage_name: string;
  to_stage_code: string;
  moved_by_name: string;
  notes: string | null;
  moved_at: string;
}

// ─── Print Forms ───────────────────────────────────────────────────────────

export interface PrintFieldValue {
  field_code: string;
  field_label: string;
  field_value: string;
  unit: string | null;
  group_code: string;
  group_label: string;
}

export interface PrintFieldGroup {
  group_code: string;
  group_label: string;
  fields: PrintFieldValue[];
}

export interface RouteStageForPrint {
  stage_name: string;
  step_order: number;
  is_completed: boolean;
  is_current: boolean;
  is_optional: boolean;
  workshop_name: string | null;
  workshop_color: string | null;
  phase: number;
}

export interface DoorPrintData {
  door_id: string;
  internal_number: string;
  marking: string | null;
  order_number: string;
  client_name: string;
  facility_name: string | null;
  floor: string | null;
  building_block: string | null;
  apartment_number: string | null;
  location_description: string | null;
  door_model_label: string | null;
  door_type: string | null;
  configuration_name: string | null;
  field_groups: PrintFieldGroup[];
  variant_fields: PrintFieldValue[];
  current_stage_name: string | null;
  route_current_step: number;
  route_total_steps: number;
  route_stages: RouteStageForPrint[];
  priority: boolean;
  item_notes: string | null;
  door_notes: string | null;
  print_date: string;
}

export interface StagePrintDoor {
  internal_number: string;
  marking: string | null;
  order_number: string;
  door_model_label: string | null;
  height: string | null;
  width: string | null;
  priority: boolean;
}

export interface StagePrintData {
  stage_name: string;
  stage_code: string;
  workshop_name: string | null;
  print_date: string;
  total_doors: number;
  doors: StagePrintDoor[];
}

// ─── Launch Checks (Sprint 17) ───────────────────────────────────────────────

export interface LaunchCheckDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LaunchCheckDefinitionCreate {
  code: string;
  name: string;
  description?: string | null;
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface LaunchCheckDefinitionUpdate {
  name?: string;
  description?: string | null;
  is_required?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export interface DoorLaunchCheck {
  id: string;
  door_id: string;
  check_id: string;
  check_name: string;
  check_description: string | null;
  is_required: boolean;
  sort_order: number;
  is_done: boolean;
  done_by: string | null;
  done_at: string | null;
  notes: string | null;
}

export interface PendingDoorCheckStatus {
  check_id: string;
  check_code: string;
  check_name: string;
  is_done: boolean;
}

export interface PendingDoor {
  id: string;
  internal_number: string;
  marking: string | null;
  order_id: string;
  order_number: string;
  item_id: string;
  door_model_id: string | null;
  door_model_label: string | null;
  client_name: string | null;
  facility_name: string | null;
  floor: string | null;
  building_block: string | null;
  apartment: string | null;
  priority: boolean;
  checks_total: number;
  checks_done: number;
  is_ready: boolean;
  check_statuses: PendingDoorCheckStatus[];
}

export interface PendingDoorsParams {
  check_ids?: string[];
  priority?: boolean;
  search?: string;
}

export interface BatchLaunchResult {
  launched: Array<{ door_id: string; internal_number: string }>;
  errors: Array<{ door_id: string; internal_number?: string; error: string }>;
  total_launched: number;
  total_errors: number;
}

// ─── Overdue (Sprint 18) ────────────────────────────────────────────────────

export interface OverdueDoor {
  door_id: string;
  internal_number: string;
  marking: string | null;
  order_id: string;
  order_number: string;
  client_name: string | null;
  door_model_id: string | null;
  door_model_label: string | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_code: string | null;
  deadline: string;
  days_overdue: number;
  route_total_steps: number;
  route_current_step: number;
  workshop_progress: WorkshopProgress[];
}

export interface OverdueQueueResponse {
  items: OverdueDoor[];
  total: number;
}

// ─── Queue Params ───────────────────────────────────────────────────────────

export interface QueueParams {
  stage_id?: string;
  workshop_id?: string;
  order_id?: string;
  door_model_id?: string;
  priority?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}
