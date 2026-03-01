/**
 * Production API — axios wrappers.
 * Sprint 13: Stages, Routes, Queue, Door Movement.
 * Sprint 16: Workshops, phased routes, workshop-aware movement.
 */
import api from "@/lib/api";
import type {
  ProductionWorkshop,
  ProductionWorkshopCreate,
  ProductionWorkshopUpdate,
  ProductionStage,
  ProductionStageCreate,
  ProductionStageUpdate,
  ProductionRoute,
  SetRoutePayload,
  ProductionQueueResponse,
  QueueParams,
  StageCounter,
  WorkshopCounter,
  ProductionDoor,
  WorkshopProgress,
  MoveDoorPayload,
  MoveDoorToStagePayload,
  DoorStageHistory,
  DoorPrintData,
  StagePrintData,
} from "@/types/production";

const BASE = "/production";

// ─── Workshops CRUD ─────────────────────────────────────────────────────────

export async function listWorkshops(includeInactive = false): Promise<ProductionWorkshop[]> {
  const { data } = await api.get<ProductionWorkshop[]>(`${BASE}/workshops`, {
    params: { include_inactive: includeInactive },
  });
  return data;
}

export async function createWorkshop(payload: ProductionWorkshopCreate): Promise<ProductionWorkshop> {
  const { data } = await api.post<ProductionWorkshop>(`${BASE}/workshops`, payload);
  return data;
}

export async function updateWorkshop(
  workshopId: string,
  payload: ProductionWorkshopUpdate,
): Promise<ProductionWorkshop> {
  const { data } = await api.patch<ProductionWorkshop>(`${BASE}/workshops/${workshopId}`, payload);
  return data;
}

export async function reorderWorkshops(workshopIds: string[]): Promise<ProductionWorkshop[]> {
  const { data } = await api.patch<ProductionWorkshop[]>(`${BASE}/workshops/reorder`, {
    workshop_ids: workshopIds,
  });
  return data;
}

// ─── Stages CRUD ────────────────────────────────────────────────────────────

export async function listStages(includeInactive = false): Promise<ProductionStage[]> {
  const { data } = await api.get<ProductionStage[]>(`${BASE}/stages`, {
    params: { include_inactive: includeInactive },
  });
  return data;
}

export async function createStage(payload: ProductionStageCreate): Promise<ProductionStage> {
  const { data } = await api.post<ProductionStage>(`${BASE}/stages`, payload);
  return data;
}

export async function updateStage(
  stageId: string,
  payload: ProductionStageUpdate,
): Promise<ProductionStage> {
  const { data } = await api.patch<ProductionStage>(`${BASE}/stages/${stageId}`, payload);
  return data;
}

export async function reorderStages(stageIds: string[]): Promise<ProductionStage[]> {
  const { data } = await api.patch<ProductionStage[]>(`${BASE}/stages/reorder`, {
    stage_ids: stageIds,
  });
  return data;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function listAllRoutes(): Promise<ProductionRoute[]> {
  const { data } = await api.get<ProductionRoute[]>(`${BASE}/routes`);
  return data;
}

export async function getRouteForModel(doorModelId: string): Promise<ProductionRoute> {
  const { data } = await api.get<ProductionRoute>(`${BASE}/routes/${doorModelId}`);
  return data;
}

export async function setRouteForModel(
  doorModelId: string,
  payload: SetRoutePayload,
): Promise<ProductionRoute> {
  const { data } = await api.put<ProductionRoute>(`${BASE}/routes/${doorModelId}`, payload);
  return data;
}

// ─── Production Queue ───────────────────────────────────────────────────────

export async function getProductionQueue(
  params?: QueueParams,
): Promise<ProductionQueueResponse> {
  const { data } = await api.get<ProductionQueueResponse>(`${BASE}/queue`, { params });
  return data;
}

export async function getStageCounters(): Promise<StageCounter[]> {
  const { data } = await api.get<StageCounter[]>(`${BASE}/queue/counters`);
  return data;
}

export async function getWorkshopCounters(): Promise<WorkshopCounter[]> {
  const { data } = await api.get<WorkshopCounter[]>(`${BASE}/queue/workshop-counters`);
  return data;
}

// ─── Door Movement ──────────────────────────────────────────────────────────

export async function moveDoorNext(
  doorId: string,
  payload?: MoveDoorPayload,
): Promise<ProductionDoor> {
  const { data } = await api.patch<ProductionDoor>(
    `${BASE}/doors/${doorId}/move-next`,
    payload ?? {},
  );
  return data;
}

export async function moveDoorPrev(
  doorId: string,
  payload?: MoveDoorPayload,
): Promise<ProductionDoor> {
  const { data } = await api.patch<ProductionDoor>(
    `${BASE}/doors/${doorId}/move-prev`,
    payload ?? {},
  );
  return data;
}

export async function moveDoorToStage(
  doorId: string,
  payload: MoveDoorToStagePayload,
): Promise<ProductionDoor> {
  const { data } = await api.patch<ProductionDoor>(
    `${BASE}/doors/${doorId}/move-to`,
    payload,
  );
  return data;
}

export async function getDoorHistory(doorId: string): Promise<DoorStageHistory[]> {
  const { data } = await api.get<DoorStageHistory[]>(`${BASE}/doors/${doorId}/history`);
  return data;
}

export async function getDoorProgress(doorId: string): Promise<WorkshopProgress[]> {
  const { data } = await api.get<WorkshopProgress[]>(`${BASE}/doors/${doorId}/progress`);
  return data;
}

// ─── Print Forms ───────────────────────────────────────────────────────────

export async function getDoorPrintData(doorId: string): Promise<DoorPrintData> {
  const { data } = await api.get<DoorPrintData>(`${BASE}/doors/${doorId}/print-data`);
  return data;
}

export async function getStagePrintData(
  stageId: string,
  limit = 100,
): Promise<StagePrintData> {
  const { data } = await api.get<StagePrintData>(`${BASE}/stages/${stageId}/print-data`, {
    params: { limit },
  });
  return data;
}
