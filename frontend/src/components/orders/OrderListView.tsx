"use client";

import { useState, useEffect, useCallback } from "react";
import { listOrders, deleteOrder, getUsersByRole } from "@/lib/ordersApi";
import { kzt, fmtDateShort, totalDoors, apiError } from "@/lib/utils";
import type { Order, OrderStatus, ClientType, UserBrief } from "@/types/orders";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/types/orders";
import { ClipboardList, Loader2, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";

interface OrderListViewProps {
  onOpenCreate: () => void;
  onOpenEdit: (order: Order) => void;
}

export function OrderListView({ onOpenCreate, onOpenEdit }: OrderListViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<UserBrief[]>([]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "">("");
  const [filterChannel, setFilterChannel] = useState<ClientType | "">("");
  const [filterManager, setFilterManager] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Load managers list once for the dropdown
  useEffect(() => {
    Promise.all([
      getUsersByRole("b2b_manager").catch(() => [] as UserBrief[]),
      getUsersByRole("b2c_manager").catch(() => [] as UserBrief[]),
      getUsersByRole("owner").catch(() => [] as UserBrief[]),
      getUsersByRole("admin").catch(() => [] as UserBrief[]),
    ]).then(([b2b, b2c, owners, admins]) => {
      const all = [...b2b, ...b2c, ...owners, ...admins];
      const seen = new Set<string>();
      setManagers(all.filter((u) => !seen.has(u.id) && !!seen.add(u.id)));
    });
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listOrders({
        search: search || undefined,
        status: filterStatus || undefined,
        client_type: filterChannel || undefined,
        manager_id: filterManager || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        page: 1,
        page_size: 50,
      });
      setOrders(result.items);
      setTotal(result.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterChannel, filterManager, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleDelete = async (orderId: string) => {
    if (!confirm("Удалить заказ?")) return;
    try {
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err) {
      alert(apiError(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-staleks-lime" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Заказы</h2>
          <p className="text-sm text-staleks-muted">{total} заказов</p>
        </div>
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-2 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar transition-colors hover:bg-staleks-lime-dark"
        >
          <Plus className="h-4 w-4" />Новый заказ
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Клиент, объект, номер..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          />
        </div>

        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as OrderStatus | "")}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
        >
          <option value="">Все статусы</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Channel */}
        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value as ClientType | "")}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
        >
          <option value="">Все каналы</option>
          <option value="b2b">B2B</option>
          <option value="b2c">B2C</option>
        </select>

        {/* Manager */}
        <select
          value={filterManager}
          onChange={(e) => setFilterManager(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
        >
          <option value="">Все менеджеры</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          title="Дата от"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-staleks-lime"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          title="Дата до"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-staleks-lime"
        />
      </div>

      {/* Content */}
      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-500">Нет заказов</p>
          <p className="mt-1 text-sm text-gray-400">Создайте первый заказ и добавьте позиции</p>
          <button
            onClick={onOpenCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar hover:bg-staleks-lime-dark"
          >
            <Plus className="h-4 w-4" />Создать заказ
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left font-medium">Номер</th>
                <th className="px-4 py-3 text-left font-medium">Клиент</th>
                <th className="px-4 py-3 text-left font-medium">Объект</th>
                <th className="px-4 py-3 text-left font-medium">Канал</th>
                <th className="px-4 py-3 text-left font-medium">Ответственный</th>
                <th className="px-4 py-3 text-left font-medium">Позиции / Двери</th>
                <th className="px-4 py-3 text-left font-medium">Статус</th>
                <th className="px-4 py-3 text-right font-medium">Сумма</th>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="group cursor-pointer transition-colors hover:bg-[#C0DF16]/5"
                  onClick={() => onOpenEdit(order)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-gray-700">{order.order_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{order.client_name}</p>
                    {order.client_company && (
                      <p className="text-xs text-gray-400">{order.client_company}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(order.facility_name ?? order.object_name)
                      ? <span className="text-xs text-gray-600">{order.facility_name ?? order.object_name}</span>
                      : <span className="text-xs text-gray-300">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "rounded-md px-1.5 py-0.5 text-xs font-semibold",
                      order.client_type === "b2b"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-teal-50 text-teal-700",
                    )}>
                      {order.client_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {order.manager_name
                      ? <span className="text-xs text-gray-600">{order.manager_name}</span>
                      : <span className="text-xs text-gray-300">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="text-xs">{order.items.length} / {totalDoors(order)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", ORDER_STATUS_COLORS[order.status])}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {order.total_price ? kzt(order.total_price) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDateShort(order.created_at)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {order.status === "draft" && (
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="hidden rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
