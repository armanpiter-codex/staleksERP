/**
 * Users API — axios wrappers.
 * Sprint 7: User CRUD + role assignment.
 */
import api from "@/lib/api";
import type { Role } from "@/types/auth";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface UserDetail {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  telegram_id: number | null;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: Role[];
}

export interface PaginatedUsers {
  items: UserDetail[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CreateUserPayload {
  username: string;
  full_name: string;
  password?: string;
  email?: string;
  phone?: string;
  telegram_id?: number;
  role_ids: string[];
}

export interface UpdateUserPayload {
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  telegram_id?: number | null;
  is_active?: boolean;
}

export interface AssignRolesPayload {
  role_ids: string[];
}

export interface ListUsersParams {
  search?: string;
  role?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

// ─── API Functions ──────────────────────────────────────────────────────────────

const BASE = "/users";

export async function listUsers(
  params?: ListUsersParams,
): Promise<PaginatedUsers> {
  const { data } = await api.get<PaginatedUsers>(BASE, { params });
  return data;
}

export async function getUser(id: string): Promise<UserDetail> {
  const { data } = await api.get<UserDetail>(`${BASE}/${id}`);
  return data;
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<UserDetail> {
  const { data } = await api.post<UserDetail>(BASE, payload);
  return data;
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<UserDetail> {
  const { data } = await api.put<UserDetail>(`${BASE}/${id}`, payload);
  return data;
}

export async function deactivateUser(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function assignRoles(
  id: string,
  payload: AssignRolesPayload,
): Promise<UserDetail> {
  const { data } = await api.post<UserDetail>(
    `${BASE}/${id}/roles`,
    payload,
  );
  return data;
}

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await api.get<Role[]>("/auth/roles");
  return data;
}
