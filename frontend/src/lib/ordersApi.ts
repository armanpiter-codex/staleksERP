/**
 * Orders API — axios wrappers.
 * Sprint 2: Order + OrderItem + OrderDoor endpoints.
 */
import api from "@/lib/api";
import type {
  BatchDoorStatusPayload,
  ClientType,
  DoorStatus,
  GenerateDoorsPayload,
  Order,
  OrderCreate,
  OrderDoor,
  OrderDoorUpdate,
  OrderItemCreate,
  OrderItemStatus,
  OrderItemUpdate,
  OrderStatus,
  OrderSummary,
  OrderUpdate,
  PaginatedOrders,
  UserBrief,
} from "@/types/orders";

const BASE = "/orders";

// ─── List ──────────────────────────────────────────────────────────────────────

export interface ListOrdersParams {
  client_type?: ClientType;
  status?: OrderStatus;
  search?: string;
  manager_id?: string;
  date_from?: string;  // ISO date: YYYY-MM-DD
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function listOrders(
  params?: ListOrdersParams,
): Promise<PaginatedOrders> {
  const { data } = await api.get<PaginatedOrders>(BASE, { params });
  return data;
}

// ─── Order CRUD ──────────────────────────────────────────────────────────────

export async function getOrder(id: string): Promise<Order> {
  const { data } = await api.get<Order>(`${BASE}/${id}`);
  return data;
}

export async function createOrder(payload: OrderCreate): Promise<Order> {
  const { data } = await api.post<Order>(BASE, payload);
  return data;
}

export async function updateOrder(
  id: string,
  payload: OrderUpdate,
): Promise<Order> {
  const { data } = await api.patch<Order>(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteOrder(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

// ─── Order Workflow ──────────────────────────────────────────────────────────

export async function transitionStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Order> {
  const { data } = await api.patch<Order>(`${BASE}/${orderId}/status`, {
    status,
  });
  return data;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export async function getOrderSummary(orderId: string): Promise<OrderSummary> {
  const { data } = await api.get<OrderSummary>(`${BASE}/${orderId}/summary`);
  return data;
}

// ─── OrderItem CRUD ──────────────────────────────────────────────────────────

export async function addItem(
  orderId: string,
  payload: OrderItemCreate,
): Promise<Order> {
  const { data } = await api.post<Order>(`${BASE}/${orderId}/items`, payload);
  return data;
}

export async function updateItem(
  orderId: string,
  itemId: string,
  payload: OrderItemUpdate,
): Promise<Order> {
  const { data } = await api.patch<Order>(
    `${BASE}/${orderId}/items/${itemId}`,
    payload,
  );
  return data;
}

export async function removeItem(
  orderId: string,
  itemId: string,
): Promise<Order> {
  const { data } = await api.delete<Order>(
    `${BASE}/${orderId}/items/${itemId}`,
  );
  return data;
}

export async function transitionItemStatus(
  orderId: string,
  itemId: string,
  status: OrderItemStatus,
): Promise<Order> {
  const { data } = await api.patch<Order>(
    `${BASE}/${orderId}/items/${itemId}/status`,
    { status },
  );
  return data;
}

// ─── OrderDoor ───────────────────────────────────────────────────────────────

export async function generateDoors(
  orderId: string,
  itemId: string,
  payload: GenerateDoorsPayload,
): Promise<OrderDoor[]> {
  const { data } = await api.post<OrderDoor[]>(
    `${BASE}/${orderId}/items/${itemId}/doors/generate`,
    payload,
  );
  return data;
}

export async function updateDoor(
  orderId: string,
  doorId: string,
  payload: OrderDoorUpdate,
): Promise<OrderDoor> {
  const { data } = await api.patch<OrderDoor>(
    `${BASE}/${orderId}/doors/${doorId}`,
    payload,
  );
  return data;
}

export async function transitionDoorStatus(
  orderId: string,
  doorId: string,
  status: DoorStatus,
): Promise<OrderDoor> {
  const { data } = await api.patch<OrderDoor>(
    `${BASE}/${orderId}/doors/${doorId}/status`,
    { status },
  );
  return data;
}

export async function batchTransitionDoorStatus(
  orderId: string,
  payload: BatchDoorStatusPayload,
): Promise<OrderDoor[]> {
  const { data } = await api.patch<OrderDoor[]>(
    `${BASE}/${orderId}/doors/batch-status`,
    payload,
  );
  return data;
}

export async function toggleDoorPriority(
  orderId: string,
  doorId: string,
): Promise<OrderDoor> {
  const { data } = await api.patch<OrderDoor>(
    `${BASE}/${orderId}/doors/${doorId}/priority`,
  );
  return data;
}

export async function deleteDoor(
  orderId: string,
  doorId: string,
): Promise<void> {
  await api.delete(`${BASE}/${orderId}/doors/${doorId}`);
}

// ─── Users (Sprint 1) ────────────────────────────────────────────────────────

export async function getUsersByRole(role: string): Promise<UserBrief[]> {
  const { data } = await api.get<UserBrief[]>("/users/by-role", {
    params: { role },
  });
  return data;
}

// ─── Configuration duplication (Sprint 1) ────────────────────────────────────

export async function duplicateConfiguration(
  configId: string,
): Promise<unknown> {
  const { data } = await api.post(
    `/configurator/configurations/${configId}/duplicate`,
  );
  return data;
}

// ─── Apply markings (Sprint 8) ───────────────────────────────────────────────

export interface ApplyMarkingsPayload {
  marking_type: "none" | "auto" | "manual";
  prefix?: string;
  start_number?: number;
  markings?: string[];
}

export async function applyMarkings(
  orderId: string,
  itemId: string,
  payload: ApplyMarkingsPayload,
): Promise<Order> {
  const { data } = await api.post<Order>(
    `${BASE}/${orderId}/items/${itemId}/apply-markings`,
    payload,
  );
  return data;
}
