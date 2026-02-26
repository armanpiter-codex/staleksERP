"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Search, UserCheck, UserX } from "lucide-react";
import {
  listUsers,
  type ListUsersParams,
  type PaginatedUsers,
  type UserDetail,
} from "@/lib/usersApi";
import { apiError, fmtDate } from "@/lib/utils";
import { Spinner, Badge, EmptyState, ErrorAlert } from "@/components/ui";
import { ROLE_LABELS, ROLE_COLORS, FILTER_ROLES } from "@/types/users";

// --- Props ---

interface Props {
  onOpenCreate: () => void;
  onOpenEdit: (user: UserDetail) => void;
}

// --- Component ---

export function UserListView({ onOpenCreate, onOpenEdit }: Props) {
  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: ListUsersParams = { page, page_size: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter === "active") params.is_active = true;
      if (statusFilter === "inactive") params.is_active = false;
      const result = await listUsers(params);
      setData(result);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter]);

  // --- Loading ---

  if (loading && !data) {
    return <Spinner size="lg" className="py-20" />;
  }

  // --- Render ---

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по имени или логину..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          >
            {FILTER_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          >
            <option value="">Все статусы</option>
            <option value="active">Активен</option>
            <option value="inactive">Заблокирован</option>
          </select>

          <button
            onClick={onOpenCreate}
            className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar transition hover:brightness-95"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Table */}
      {data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">ФИО</th>
                <th className="px-4 py-3 font-medium">Логин</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 font-medium">Роли</th>
                <th className="px-4 py-3 font-medium text-center">Статус</th>
                <th className="px-4 py-3 font-medium">Последний вход</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => onOpenEdit(u)}
                  className="cursor-pointer transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.username}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge
                          key={r.id}
                          className={ROLE_COLORS[r.name] || "bg-gray-100 text-gray-700"}
                        >
                          {ROLE_LABELS[r.name] || r.display_name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.is_active ? (
                      <Badge variant="success" className="inline-flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        Активен
                      </Badge>
                    ) : (
                      <Badge variant="error" className="inline-flex items-center gap-1">
                        <UserX className="h-3 w-3" />
                        Заблокирован
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
              <span>
                {data.total} пользователей, стр. {data.page} из {data.pages}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
                >
                  Назад
                </button>
                <button
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
                >
                  Далее
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        !loading && <EmptyState text="Пользователи не найдены" />
      )}
    </div>
  );
}
