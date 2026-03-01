"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, Loader2, Shield, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import {
  listPermissions,
  listRolesWithPermissions,
  updateRolePermissions,
} from "@/lib/authApi";
import type { Permission, RoleWithPermissions } from "@/lib/authApi";
import { apiError } from "@/lib/utils";
import { ErrorAlert, Spinner } from "@/components/ui";

// Group permissions by module for display
function groupByModule(permissions: Permission[]) {
  const groups: Record<string, Permission[]> = {};
  for (const p of permissions) {
    if (!groups[p.module]) groups[p.module] = [];
    groups[p.module].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

const MODULE_LABELS: Record<string, string> = {
  auth: "Аутентификация",
  admin: "Администрирование",
  orders: "Заказы",
  configurator: "Конфигуратор",
  production: "Производство",
  feedback: "Обратная связь",
};

export function PermissionsTab() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Track modified state per role: roleId -> Set<permissionId>
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [perms, rls] = await Promise.all([
        listPermissions(),
        listRolesWithPermissions(),
      ]);
      setPermissions(perms);
      setRoles(rls);

      // Build initial matrix
      const m: Record<string, Set<string>> = {};
      for (const role of rls) {
        m[role.id] = new Set(role.permissions.map((p) => p.id));
      }
      setMatrix(m);
      setDirty(new Set());
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const togglePermission = (roleId: string, permissionId: string) => {
    setMatrix((prev) => {
      const updated = { ...prev };
      const set = new Set(updated[roleId]);
      if (set.has(permissionId)) {
        set.delete(permissionId);
      } else {
        set.add(permissionId);
      }
      updated[roleId] = set;
      return updated;
    });
    setDirty((prev) => new Set(prev).add(roleId));
  };

  const handleSave = async (roleId: string) => {
    setSaving(roleId);
    setError("");
    try {
      const permIds = Array.from(matrix[roleId] || []);
      const updatedRole = await updateRolePermissions(roleId, permIds);
      // Update roles state
      setRoles((prev) =>
        prev.map((r) => (r.id === roleId ? updatedRole : r)),
      );
      // Update matrix with server response
      setMatrix((prev) => ({
        ...prev,
        [roleId]: new Set(updatedRole.permissions.map((p) => p.id)),
      }));
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(roleId);
        return next;
      });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <Spinner size="lg" />;

  const grouped = groupByModule(permissions);
  const isOwner = (role: RoleWithPermissions) => role.name === "owner";

  return (
    <div className="mt-4 space-y-4">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <span>
          Управление правами ролей. Роль «Владелец» имеет все права и не может быть изменена.
          Изменения вступят в силу при следующем входе пользователей.
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[250px]">
                Право
              </th>
              {roles.map((role) => (
                <th
                  key={role.id}
                  className="text-center px-3 py-3 font-medium text-gray-700 min-w-[100px]"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs">{role.display_name}</span>
                    {dirty.has(role.id) && !isOwner(role) && (
                      <button
                        onClick={() => handleSave(role.id)}
                        disabled={saving === role.id}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-staleks-lime text-staleks-sidebar text-[10px] font-semibold hover:brightness-95 disabled:opacity-50"
                      >
                        {saving === role.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Save size={10} />
                        )}
                        Сохранить
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map(([module, perms]) => (
              <ModuleGroup
                key={module}
                module={module}
                permissions={perms}
                roles={roles}
                matrix={matrix}
                onToggle={togglePermission}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModuleGroup({
  module,
  permissions,
  roles,
  matrix,
  onToggle,
}: {
  module: string;
  permissions: Permission[];
  roles: RoleWithPermissions[];
  matrix: Record<string, Set<string>>;
  onToggle: (roleId: string, permissionId: string) => void;
}) {
  return (
    <>
      {/* Module header row */}
      <tr className="bg-gray-50/70">
        <td
          colSpan={roles.length + 1}
          className="px-4 py-2 font-semibold text-xs uppercase tracking-wide text-gray-500 sticky left-0 bg-gray-50/70"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} />
            {MODULE_LABELS[module] || module}
          </div>
        </td>
      </tr>
      {permissions.map((perm) => (
        <tr key={perm.id} className="border-t border-gray-100 hover:bg-gray-50/50">
          <td className="px-4 py-2 sticky left-0 bg-white z-10">
            <div>
              <span className="font-mono text-xs text-gray-600">{perm.code}</span>
              {perm.description && (
                <p className="text-[11px] text-gray-400 mt-0.5">{perm.description}</p>
              )}
            </div>
          </td>
          {roles.map((role) => {
            const isOwnerRole = role.name === "owner";
            const checked = isOwnerRole || (matrix[role.id]?.has(perm.id) ?? false);
            return (
              <td key={role.id} className="text-center px-3 py-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isOwnerRole}
                  onChange={() => onToggle(role.id, perm.id)}
                  className={clsx(
                    "h-4 w-4 rounded border-gray-300 transition",
                    isOwnerRole
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-staleks-lime focus:ring-staleks-lime cursor-pointer",
                  )}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
