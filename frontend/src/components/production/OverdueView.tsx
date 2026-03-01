"use client";

/**
 * OverdueView — Sprint 18: Мониторинг просроченных дверей.
 *
 * Показывает двери в производстве, у которых дедлайн (desired_delivery_date заказа)
 * уже прошёл. Только просмотр — без кнопок перемещения.
 */

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Clock, Loader2, RotateCcw, Search } from "lucide-react";
import clsx from "clsx";
import { getOverdueDoors } from "@/lib/productionApi";
import type { OverdueDoor, WorkshopProgress } from "@/types/production";
import { ErrorAlert } from "@/components/ui";
import { apiError } from "@/lib/utils";

const PAGE_SIZE = 50;

// ─── Urgency helpers ─────────────────────────────────────────────────────────

function urgencyClasses(days: number): string {
  if (days <= 2) return "bg-yellow-50 text-yellow-800 border-yellow-200";
  if (days <= 7) return "bg-red-50 text-red-700 border-red-200";
  return "bg-red-100 text-red-900 border-red-300 font-semibold";
}

function urgencyRowBg(days: number): string {
  if (days <= 2) return "bg-yellow-50/40";
  if (days <= 7) return "bg-red-50/40";
  return "bg-red-100/40";
}

function urgencyIcon(days: number): string {
  if (days <= 2) return "text-yellow-500";
  if (days <= 7) return "text-red-500";
  return "text-red-700";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Workshop progress bar ────────────────────────────────────────────────────

function WorkshopProgressBars({ progress }: { progress: WorkshopProgress[] }) {
  if (progress.length === 0) return <span className="text-staleks-muted text-xs">—</span>;

  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      {progress.map((p) => {
        const pct =
          p.track_total_steps > 0
            ? Math.round((p.track_current_step / p.track_total_steps) * 100)
            : p.status === "completed"
            ? 100
            : 0;
        const barColor =
          p.status === "completed"
            ? "bg-staleks-lime"
            : p.status === "active"
            ? "bg-blue-400"
            : "bg-gray-200";

        return (
          <div key={`${p.phase}-${p.workshop_id}`} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.workshop_color ?? "#9ca3af" }}
            />
            <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[48px]">
              <div
                className={clsx("h-1.5 rounded-full transition-all", barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-staleks-muted">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OverdueView() {
  const [items, setItems] = useState<OverdueDoor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOverdueDoors({
        search: search || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [search, offset]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setOffset(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-red-500" size={20} />
          <span className="font-semibold text-gray-700">
            Просроченные двери
          </span>
          {total > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-staleks-muted"
              />
              <input
                type="text"
                placeholder="Номер, маркировка, заказ..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-staleks-lime w-56"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm bg-staleks-sidebar text-white rounded-lg hover:opacity-90"
            >
              Найти
            </button>
          </form>
          <button
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setOffset(0);
            }}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-staleks-muted hover:text-gray-700"
            title="Сбросить"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} onClose={() => setError(null)} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-staleks-muted" size={28} />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-staleks-muted">
          <Clock size={40} className="mb-3 text-staleks-lime" />
          <p className="font-medium text-gray-600">Нет просроченных дверей</p>
          <p className="text-sm mt-1">
            Все двери укладываются в сроки — отличная работа!
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && items.length > 0 && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-xs text-staleks-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-yellow-200" />
              ≤ 2 дня
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-red-300" />
              3–7 дней
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-red-500" />
              &gt; 7 дней
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Номер
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Маркировка
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Заказ / Клиент
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Модель
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Дедлайн
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Просрочка
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Текущий этап
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                    Прогресс
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((door) => (
                  <tr
                    key={door.door_id}
                    className={clsx(
                      "hover:bg-white/70 transition-colors",
                      urgencyRowBg(door.days_overdue),
                    )}
                  >
                    {/* Номер */}
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-gray-800">
                        {door.internal_number}
                      </span>
                    </td>

                    {/* Маркировка */}
                    <td className="px-4 py-3 text-gray-600">
                      {door.marking ?? <span className="text-staleks-muted">—</span>}
                    </td>

                    {/* Заказ / Клиент */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{door.order_number}</div>
                      {door.client_name && (
                        <div className="text-xs text-staleks-muted mt-0.5 truncate max-w-[140px]">
                          {door.client_name}
                        </div>
                      )}
                    </td>

                    {/* Модель */}
                    <td className="px-4 py-3 text-gray-600">
                      {door.door_model_label ?? (
                        <span className="text-staleks-muted">—</span>
                      )}
                    </td>

                    {/* Дедлайн */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          size={13}
                          className={urgencyIcon(door.days_overdue)}
                        />
                        <span className="text-gray-700">{formatDate(door.deadline)}</span>
                      </div>
                    </td>

                    {/* Просрочка */}
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-xs border",
                          urgencyClasses(door.days_overdue),
                        )}
                      >
                        +{door.days_overdue}{" "}
                        {door.days_overdue === 1
                          ? "день"
                          : door.days_overdue >= 2 && door.days_overdue <= 4
                          ? "дня"
                          : "дней"}
                      </span>
                    </td>

                    {/* Текущий этап */}
                    <td className="px-4 py-3">
                      {door.current_stage_name ? (
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {door.current_stage_name}
                        </span>
                      ) : (
                        <span className="text-staleks-muted text-xs">Нет этапа</span>
                      )}
                    </td>

                    {/* Прогресс */}
                    <td className="px-4 py-3">
                      {door.workshop_progress.length > 0 ? (
                        <WorkshopProgressBars progress={door.workshop_progress} />
                      ) : door.route_total_steps > 0 ? (
                        <div className="flex items-center gap-2 min-w-[80px]">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-staleks-lime transition-all"
                              style={{
                                width: `${Math.round(
                                  (door.route_current_step / door.route_total_steps) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-staleks-muted whitespace-nowrap">
                            {door.route_current_step}/{door.route_total_steps}
                          </span>
                        </div>
                      ) : (
                        <span className="text-staleks-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-staleks-muted">
              <span>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} из {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Назад
                </button>
                <span className="px-3 py-1.5">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setOffset(Math.min((totalPages - 1) * PAGE_SIZE, offset + PAGE_SIZE))
                  }
                  disabled={offset + PAGE_SIZE >= total}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
