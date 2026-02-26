/**
 * Services API — axios wrappers for service types and order services.
 */
import api from "@/lib/api";
import type {
  OrderService,
  OrderServiceCreate,
  OrderServiceUpdate,
  ServiceType,
  ServiceTypeCreate,
  ServiceTypeUpdate,
} from "@/types/services";

// ─── Service Types (technologist) ────────────────────────────────────────────

export async function listServiceTypes(includeInactive = false): Promise<ServiceType[]> {
  const { data } = await api.get<ServiceType[]>("/service-types", {
    params: includeInactive ? { include_inactive: true } : undefined,
  });
  return data;
}

export async function createServiceType(payload: ServiceTypeCreate): Promise<ServiceType> {
  const { data } = await api.post<ServiceType>("/service-types", payload);
  return data;
}

export async function updateServiceType(id: string, payload: ServiceTypeUpdate): Promise<ServiceType> {
  const { data } = await api.patch<ServiceType>(`/service-types/${id}`, payload);
  return data;
}

// ─── Order Services (manager) ────────────────────────────────────────────────

export async function listOrderServices(orderId: string): Promise<OrderService[]> {
  const { data } = await api.get<OrderService[]>(`/orders/${orderId}/services`);
  return data;
}

export async function addOrderService(orderId: string, payload: OrderServiceCreate): Promise<OrderService> {
  const { data } = await api.post<OrderService>(`/orders/${orderId}/services`, payload);
  return data;
}

export async function updateOrderService(
  orderId: string,
  svcId: string,
  payload: OrderServiceUpdate,
): Promise<OrderService> {
  const { data } = await api.patch<OrderService>(`/orders/${orderId}/services/${svcId}`, payload);
  return data;
}

export async function removeOrderService(orderId: string, svcId: string): Promise<void> {
  await api.delete(`/orders/${orderId}/services/${svcId}`);
}
