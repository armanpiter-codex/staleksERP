// ─── Production Stage ────────────────────────────────────────────────────────

export interface ProductionStage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionStageCreate {
  code: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface ProductionStageUpdate {
  name?: string | null;
  description?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
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
}

export interface ProductionRoute {
  door_model_id: string;
  door_model_code: string;
  door_model_label: string;
  steps: RouteStep[];
}

export interface RouteStepInput {
  stage_id: string;
  step_order: number;
  is_optional?: boolean;
  notes?: string | null;
}

export interface SetRoutePayload {
  steps: RouteStepInput[];
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
}

export interface StageCounter {
  stage_id: string | null;
  stage_name: string;
  stage_code: string;
  count: number;
}

export interface ProductionQueueResponse {
  items: ProductionDoor[];
  total: number;
  counters: StageCounter[];
}

// ─── Door Movement ──────────────────────────────────────────────────────────

export interface MoveDoorPayload {
  notes?: string | null;
}

export interface MoveDoorToStagePayload {
  stage_id: string;
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
  print_date: string;
  total_doors: number;
  doors: StagePrintDoor[];
}

// ─── Queue Params ───────────────────────────────────────────────────────────

export interface QueueParams {
  stage_id?: string;
  order_id?: string;
  door_model_id?: string;
  priority?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}
