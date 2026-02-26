import api from "./api";
import type { Facility } from "@/types/orders";

const BASE = "/facilities";

export async function listFacilities(includeInactive = false): Promise<Facility[]> {
  const { data } = await api.get<Facility[]>(BASE, {
    params: includeInactive ? { include_inactive: true } : undefined,
  });
  return data;
}

export async function createFacility(name: string): Promise<Facility> {
  const { data } = await api.post<Facility>(BASE, { name });
  return data;
}

export async function updateFacility(
  id: string,
  payload: { name?: string; is_active?: boolean }
): Promise<Facility> {
  const { data } = await api.patch<Facility>(`${BASE}/${id}`, payload);
  return data;
}
