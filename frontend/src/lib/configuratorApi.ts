/**
 * Configurator API — axios wrappers for all configurator endpoints.
 */
import api from "@/lib/api";
import type {
  BOM,
  BulkMarkingsImportInput,
  ConfiguratorCatalog,
  DoorConfiguration,
  DoorConfigurationCreate,
  DoorConfigurationUpdate,
  DoorFieldDefinition,
  DoorFieldGroup,
  DoorFieldGroupCreate,
  DoorFieldGroupUpdate,
  DoorMarking,
  DoorMarkingCreate,
  DoorMarkingUpdate,
  DoorModel,
  DoorModelCreate,
  DoorModelUpdate,
  GenerateMarkingsInput,
  MaterialNorm,
  PriceCalculation,
  PricingRule,
  VisibilityRule,
} from "@/types/configurator";

const BASE = "/configurator";

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function getCatalog(): Promise<ConfiguratorCatalog> {
  const { data } = await api.get<ConfiguratorCatalog>(`${BASE}/catalog`);
  return data;
}

// ─── Door Models ─────────────────────────────────────────────────────────────

export async function listModels(): Promise<DoorModel[]> {
  const { data } = await api.get<DoorModel[]>(`${BASE}/models`);
  return data;
}

export async function createModel(payload: DoorModelCreate): Promise<DoorModel> {
  const { data } = await api.post<DoorModel>(`${BASE}/models`, payload);
  return data;
}

export async function updateModel(code: string, payload: DoorModelUpdate): Promise<DoorModel> {
  const { data } = await api.patch<DoorModel>(`${BASE}/models/${code}`, payload);
  return data;
}

export async function deleteModel(code: string): Promise<void> {
  await api.delete(`${BASE}/models/${code}`);
}

// ─── Door Field Groups ───────────────────────────────────────────────────────

export async function listGroups(): Promise<DoorFieldGroup[]> {
  const { data } = await api.get<DoorFieldGroup[]>(`${BASE}/groups`);
  return data;
}

export async function createGroup(payload: DoorFieldGroupCreate): Promise<DoorFieldGroup> {
  const { data } = await api.post<DoorFieldGroup>(`${BASE}/groups`, payload);
  return data;
}

export async function updateGroup(code: string, payload: DoorFieldGroupUpdate): Promise<DoorFieldGroup> {
  const { data } = await api.patch<DoorFieldGroup>(`${BASE}/groups/${code}`, payload);
  return data;
}

export async function deleteGroup(code: string): Promise<void> {
  await api.delete(`${BASE}/groups/${code}`);
}

// ─── Configurations ───────────────────────────────────────────────────────────

export interface ListConfigurationsParams {
  order_id?: string;
  status?: string;
  door_type?: string;
  is_template?: boolean;
  skip?: number;
  limit?: number;
}

export async function listConfigurations(
  params?: ListConfigurationsParams,
): Promise<DoorConfiguration[]> {
  const { data } = await api.get<DoorConfiguration[]>(`${BASE}/configurations`, {
    params,
  });
  return data;
}

export async function getConfiguration(id: string): Promise<DoorConfiguration> {
  const { data } = await api.get<DoorConfiguration>(
    `${BASE}/configurations/${id}`,
  );
  return data;
}

export async function createConfiguration(
  payload: DoorConfigurationCreate,
): Promise<DoorConfiguration> {
  const { data } = await api.post<DoorConfiguration>(
    `${BASE}/configurations`,
    payload,
  );
  return data;
}

export async function updateConfiguration(
  id: string,
  payload: DoorConfigurationUpdate,
): Promise<DoorConfiguration> {
  const { data } = await api.patch<DoorConfiguration>(
    `${BASE}/configurations/${id}`,
    payload,
  );
  return data;
}

export async function deleteConfiguration(id: string): Promise<void> {
  await api.delete(`${BASE}/configurations/${id}`);
}

// ─── Price & BOM ──────────────────────────────────────────────────────────────

export async function getPriceCalculation(id: string): Promise<PriceCalculation> {
  const { data } = await api.get<PriceCalculation>(
    `${BASE}/configurations/${id}/price`,
  );
  return data;
}

export async function getBOM(id: string): Promise<BOM> {
  const { data } = await api.get<BOM>(`${BASE}/configurations/${id}/bom`);
  return data;
}

// ─── Markings ─────────────────────────────────────────────────────────────────

export async function listMarkings(configId: string): Promise<DoorMarking[]> {
  const { data } = await api.get<DoorMarking[]>(
    `${BASE}/configurations/${configId}/markings`,
  );
  return data;
}

export async function createMarking(
  configId: string,
  payload: DoorMarkingCreate,
): Promise<DoorMarking> {
  const { data } = await api.post<DoorMarking>(
    `${BASE}/configurations/${configId}/markings`,
    payload,
  );
  return data;
}

export async function generateMarkings(
  configId: string,
  payload: GenerateMarkingsInput,
): Promise<DoorMarking[]> {
  const { data } = await api.post<DoorMarking[]>(
    `${BASE}/configurations/${configId}/markings/generate`,
    payload,
  );
  return data;
}

export async function bulkImportMarkings(
  configId: string,
  payload: BulkMarkingsImportInput,
): Promise<DoorMarking[]> {
  const { data } = await api.post<DoorMarking[]>(
    `${BASE}/configurations/${configId}/markings/bulk-import`,
    payload,
  );
  return data;
}

export async function clearMarkings(configId: string): Promise<void> {
  await api.delete(`${BASE}/configurations/${configId}/markings`);
}

export async function updateMarking(
  markingId: string,
  payload: DoorMarkingUpdate,
): Promise<DoorMarking> {
  const { data } = await api.patch<DoorMarking>(
    `${BASE}/markings/${markingId}`,
    payload,
  );
  return data;
}

export async function deleteMarking(markingId: string): Promise<void> {
  await api.delete(`${BASE}/markings/${markingId}`);
}

// ─── Field Definitions (admin CRUD) ──────────────────────────────────────────

export interface FieldDefinitionCreate {
  code: string;
  label: string;
  label_short?: string | null;
  field_type: string;
  group_code: string;
  group_label: string;
  sort_order?: number;
  options?: Array<{ value: string; label: string }> | null;
  default_value?: string | null;
  is_required?: boolean;
  door_type_applicability?: string[];
  unit?: string | null;
  notes?: string | null;
  is_display?: boolean;
  display_order?: number | null;
}

export interface FieldDefinitionUpdate {
  label?: string;
  label_short?: string | null;
  group_code?: string;
  group_label?: string;
  sort_order?: number;
  options?: Array<{ value: string; label: string }> | null;
  default_value?: string | null;
  is_required?: boolean;
  door_type_applicability?: string[];
  unit?: string | null;
  notes?: string | null;
  is_active?: boolean;
  is_display?: boolean;
  display_order?: number | null;
}

export async function createFieldDefinition(
  payload: FieldDefinitionCreate,
): Promise<DoorFieldDefinition> {
  const { data } = await api.post<DoorFieldDefinition>(`${BASE}/fields`, payload);
  return data;
}

export async function updateFieldDefinition(
  code: string,
  payload: FieldDefinitionUpdate,
): Promise<DoorFieldDefinition> {
  const { data } = await api.patch<DoorFieldDefinition>(`${BASE}/fields/${code}`, payload);
  return data;
}

export async function deleteFieldDefinition(code: string): Promise<void> {
  await api.delete(`${BASE}/fields/${code}`);
}

// ─── Pricing Rules ────────────────────────────────────────────────────────────

export async function listPricingRules(
  fieldCode?: string,
): Promise<PricingRule[]> {
  const { data } = await api.get<PricingRule[]>(`${BASE}/pricing-rules`, {
    params: fieldCode ? { field_code: fieldCode } : undefined,
  });
  return data;
}

export interface PricingRuleCreate {
  field_code: string;
  field_value: string;
  price_component: string;
  cost_component: string;
  notes?: string | null;
}

export interface PricingRuleUpdate {
  price_component?: string;
  cost_component?: string;
  notes?: string | null;
}

export async function createPricingRule(
  payload: PricingRuleCreate,
): Promise<PricingRule> {
  const { data } = await api.post<PricingRule>(`${BASE}/pricing-rules`, payload);
  return data;
}

export async function updatePricingRule(
  id: string,
  payload: PricingRuleUpdate,
): Promise<PricingRule> {
  const { data } = await api.patch<PricingRule>(`${BASE}/pricing-rules/${id}`, payload);
  return data;
}

export async function deletePricingRule(id: string): Promise<void> {
  await api.delete(`${BASE}/pricing-rules/${id}`);
}

// ─── Material Norms ───────────────────────────────────────────────────────────

export async function listMaterialNorms(
  fieldCode?: string,
): Promise<MaterialNorm[]> {
  const { data } = await api.get<MaterialNorm[]>(`${BASE}/material-norms`, {
    params: fieldCode ? { field_code: fieldCode } : undefined,
  });
  return data;
}

export interface MaterialNormCreate {
  field_code: string;
  field_value: string;
  material_name: string;
  material_code?: string | null;
  unit: string;
  quantity_formula: string;
  notes?: string | null;
}

export async function createMaterialNorm(
  payload: MaterialNormCreate,
): Promise<MaterialNorm> {
  const { data } = await api.post<MaterialNorm>(`${BASE}/material-norms`, payload);
  return data;
}

export async function deleteMaterialNorm(id: string): Promise<void> {
  await api.delete(`${BASE}/material-norms/${id}`);
}

// ─── Visibility Rules ─────────────────────────────────────────────────────────

export async function listVisibilityRules(): Promise<VisibilityRule[]> {
  const { data } = await api.get<VisibilityRule[]>(`${BASE}/visibility-rules`);
  return data;
}

export interface VisibilityRuleCreate {
  field_code: string;
  depends_on_field_code: string;
  depends_on_value: string | string[];
  rule_type: "show_when" | "hide_when";
}

export async function createVisibilityRule(
  payload: VisibilityRuleCreate,
): Promise<VisibilityRule> {
  const { data } = await api.post<VisibilityRule>(`${BASE}/visibility-rules`, payload);
  return data;
}

export async function deleteVisibilityRule(id: string): Promise<void> {
  await api.delete(`${BASE}/visibility-rules/${id}`);
}
