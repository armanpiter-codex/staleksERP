/**
 * Production API — axios wrappers.
 * Sprint 13: Stages, Routes, Queue, Door Movement.
 */
import api from "@/lib/api";
import type {
  ProductionStage,
  ProductionStageCreate,
  ProductionStageUpdate,
  ProductionRoute,
  SetRoutePayload,
  ProductionQueueResponse,
  QueueParams,
  StageCounter,
  ProductionDoor,
  MoveDoorPayload,
  MoveDoorToStagePayload,
  DoorStageHistory,
  DoorPrintData,
  StagePrintData,
} from "@/types/production";

const BASE = "/production";

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
