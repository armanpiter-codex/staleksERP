/**
 * Auth API — wrappers for permission/role management endpoints.
 */
import api from "@/lib/api";

export interface Permission {
  id: string;
  code: string;
  description: string | null;
  module: string;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  permissions: Permission[];
}

export async function listPermissions(): Promise<Permission[]> {
  const { data } = await api.get<Permission[]>("/auth/permissions");
  return data;
}

export async function listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const { data } = await api.get<RoleWithPermissions[]>("/auth/roles");
  return data;
}

export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<RoleWithPermissions> {
  const { data } = await api.put<RoleWithPermissions>(
    `/auth/roles/${roleId}/permissions`,
    { permission_ids: permissionIds },
  );
  return data;
}
