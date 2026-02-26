import { useAuth } from "@/contexts/AuthContext";

export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.permissions.includes(permission);
}

export function useAnyPermission(...permissions: string[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return permissions.some((p) => user.permissions.includes(p));
}

export function useRole(role: string): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.roles.some((r) => r.name === role);
}
