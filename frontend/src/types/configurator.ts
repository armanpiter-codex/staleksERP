// ─── Enums ────────────────────────────────────────────────────────────────────

export type DoorType = "technical" | "finish";

export type FieldType = "select" | "text" | "number" | "boolean" | "multiselect";

export type ConfigurationStatus = "draft" | "confirmed" | "in_production" | "completed";

export type MarkingStatus = "pending" | "in_production" | "completed" | "shipped";

export type VisibilityRuleType = "show_when" | "hide_when";

export type FieldLayer = "core" | "variant";

// ─── Field Definitions ────────────────────────────────────────────────────────

export interface FieldOption {
  value: string;
  label: string;
}

export interface DoorFieldDefinition {
  id: string;
  code: string;
  label: string;
  label_short: string | null;
  field_type: FieldType;
  group_code: string;
  group_label: string;
  sort_order: number;
  options: FieldOption[] | null;
  default_value: string | null;
  is_required: boolean;
  door_type_applicability: string[];
  layer: FieldLayer;
  unit: string | null;
  notes: string | null;
  is_active: boolean;
  is_display: boolean;
  display_order: number | null;
  is_print: boolean;
  print_order: number | null;
}

// ─── Visibility Rules ─────────────────────────────────────────────────────────

export interface VisibilityRule {
  id: string;
  field_code: string;
  depends_on_field_code: string;
  depends_on_value: string | string[];
  rule_type: VisibilityRuleType;
}

// ─── Door Models ─────────────────────────────────────────────────────────────

export interface DoorModel {
  id: string;
  code: string;
  label: string;
  label_short: string | null;
  door_type: DoorType;
  sort_order: number;
  is_active: boolean;
  no_exterior: boolean;
  notes: string | null;
}

export interface DoorModelCreate {
  code: string;
  label: string;
  label_short?: string | null;
  door_type: DoorType;
  sort_order?: number;
  no_exterior?: boolean;
  notes?: string | null;
}

export interface DoorModelUpdate {
  label?: string;
  label_short?: string | null;
  door_type?: DoorType;
  sort_order?: number;
  is_active?: boolean;
  no_exterior?: boolean;
  notes?: string | null;
}

// ─── Door Field Groups ───────────────────────────────────────────────────────

export interface DoorFieldGroup {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  door_type_applicability: string[];
  notes: string | null;
}

export interface DoorFieldGroupCreate {
  code: string;
  label: string;
  sort_order?: number;
  door_type_applicability?: string[];
  notes?: string | null;
}

export interface DoorFieldGroupUpdate {
  label?: string;
  sort_order?: number;
  is_active?: boolean;
  door_type_applicability?: string[];
  notes?: string | null;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface ConfiguratorCatalog {
  field_definitions: DoorFieldDefinition[];
  visibility_rules: VisibilityRule[];
  groups: DoorFieldGroup[];
  models: DoorModel[];
}

// ─── Markings ─────────────────────────────────────────────────────────────────

export interface DoorMarking {
  id: string;
  configuration_id: string;
  marking: string;
  floor: string | null;
  location_description: string | null;
  status: MarkingStatus;
  qr_code: string | null;
  notes: string | null;
  created_at: string;
}

export interface DoorMarkingCreate {
  marking: string;
  floor?: string | null;
  location_description?: string | null;
  notes?: string | null;
}

export interface DoorMarkingUpdate {
  floor?: string | null;
  location_description?: string | null;
  status?: MarkingStatus;
  notes?: string | null;
}

export interface GenerateMarkingsInput {
  prefix: string;
  start_number: number;
  count: number;
  zero_pad: number;
}

export interface BulkMarkingImportRow {
  marking: string;
  floor?: string | null;
  location_description?: string | null;
}

export interface BulkMarkingsImportInput {
  markings: BulkMarkingImportRow[];
}

// ─── Configuration ────────────────────────────────────────────────────────────

export type ConfigurationValues = Record<string, string | number | boolean | null>;

export interface DoorConfiguration {
  id: string;
  order_id: string | null;
  door_type: DoorType;
  name: string;
  quantity: number;
  values: ConfigurationValues;
  price_estimate: string | null;
  cost_price: string | null;
  locked_price: string | null;
  locked_cost: string | null;
  is_template: boolean;
  status: ConfigurationStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  markings: DoorMarking[];
}

export interface DoorConfigurationCreate {
  door_type: DoorType;
  name: string;
  quantity: number;
  values?: ConfigurationValues;
  is_template?: boolean;
  notes?: string | null;
  order_id?: string | null;
}

export interface DoorConfigurationUpdate {
  name?: string;
  quantity?: number;
  values?: ConfigurationValues;
  status?: ConfigurationStatus;
  notes?: string | null;
}

// ─── Price Calculation ────────────────────────────────────────────────────────

export interface PriceBreakdownLine {
  field_code: string;
  field_label: string;
  field_value: string;
  price_component: string;
  cost_component: string;
}

export interface PriceCalculation {
  configuration_id: string;
  door_quantity: number;
  price_per_door: string;
  cost_per_door: string;
  price_total: string;
  cost_total: string;
  margin_percent: number | null;
  breakdown: PriceBreakdownLine[];
}

// ─── BOM ──────────────────────────────────────────────────────────────────────

export interface BOMLine {
  material_name: string;
  material_code: string | null;
  unit: string;
  quantity_per_door: number;
  quantity_total: number;
}

export interface BOM {
  configuration_id: string;
  door_quantity: number;
  lines: BOMLine[];
}

// ─── Pricing Rules ────────────────────────────────────────────────────────────

export interface PricingRule {
  id: string;
  field_code: string;
  field_value: string;
  price_component: string;
  cost_component: string;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
}

// ─── Material Norms ───────────────────────────────────────────────────────────

export interface MaterialNorm {
  id: string;
  field_code: string;
  field_value: string;
  material_name: string;
  material_code: string | null;
  unit: string;
  quantity_formula: string;
  notes: string | null;
}

// ─── Helpers for frontend rule engine ─────────────────────────────────────────

/**
 * Вычисляет видимость поля на основе текущих значений конфигурации.
 * @param fieldCode — код поля, видимость которого проверяем
 * @param rules — все правила видимости из каталога
 * @param currentValues — текущие значения конфигурации
 */
export function isFieldVisible(
  fieldCode: string,
  rules: VisibilityRule[],
  currentValues: ConfigurationValues,
): boolean {
  const fieldRules = rules.filter((r) => r.field_code === fieldCode);
  if (fieldRules.length === 0) return true; // Нет правил — всегда виден

  for (const rule of fieldRules) {
    const dependsOnValue = currentValues[rule.depends_on_field_code];
    const targetValues = Array.isArray(rule.depends_on_value)
      ? rule.depends_on_value
      : [rule.depends_on_value];

    const matches = targetValues.some(
      (tv) => String(dependsOnValue ?? "") === String(tv),
    );

    if (rule.rule_type === "show_when" && !matches) return false;
    if (rule.rule_type === "hide_when" && matches) return false;
  }

  return true;
}

/**
 * Фильтрует поля конфигуратора для конкретного типа двери.
 */
export function filterFieldsByDoorType(
  fields: DoorFieldDefinition[],
  doorType: DoorType,
): DoorFieldDefinition[] {
  return fields.filter((f) => f.door_type_applicability.includes(doorType));
}

/**
 * Фильтрует поля по слою (core/variant).
 */
export function filterFieldsByLayer(
  fields: DoorFieldDefinition[],
  layer: FieldLayer,
): DoorFieldDefinition[] {
  return fields.filter((f) => f.layer === layer);
}

// ─── Status labels ────────────────────────────────────────────────────────────

export const CONFIG_STATUS_LABELS: Record<ConfigurationStatus, string> = {
  draft: "Черновик",
  confirmed: "Утверждена",
  in_production: "В производстве",
  completed: "Завершена",
};

export const CONFIG_STATUS_COLORS: Record<ConfigurationStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_production: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
};

export const MARKING_STATUS_LABELS: Record<MarkingStatus, string> = {
  pending: "Ожидает",
  in_production: "В производстве",
  completed: "Готова",
  shipped: "Отгружена",
};

export const DOOR_TYPE_LABELS: Record<DoorType, string> = {
  technical: "Техническая",
  finish: "С Отделкой",
};
