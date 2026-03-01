"use client";

/**
 * LaunchView — Sprint 18.1: Запуск дверей в производство (фильтры).
 *
 * Показывает pending-двери из активных заказов.
 * Вверху — фильтры-чекбоксы (из launch_check_definitions + «Приоритет»).
 * Плоская таблица без раскрытия; статус-пилюли чеков на каждой строке.
 * Клик по пилюле → toggle is_done через popover.
 * Batch-запуск: переводит выбранные двери в in_production.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckCircle2,
  Loader2,
  Rocket,
  RotateCcw,
  Search,
  Star,
  AlertTriangle,
  Filter,
  X,
} from "lucide-react";
import clsx from "clsx";
import {
  listPendingDoors,
  listLaunchChecks,
  updateDoorLaunchCheck,
  batchLaunch,
} from "@/lib/productionApi";
import type {
  PendingDoor,
  LaunchCheckDefinition,
  BatchLaunchResult,
  PendingDoorCheckStatus,
} from "@/types/production";
import { apiError } from "@/lib/utils";
import { ErrorAlert } from "@/components/ui";

// ─── Check Status Pill ──────────────────────────────────────────────────────

interface CheckPillProps {
  status: PendingDoorCheckStatus;
  doorId: string;
  onToggled: () => void;
}

function CheckPill({ status, doorId, onToggled }: CheckPillProps) {
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = async () => {
    setToggling(true);
    try {
      await updateDoorLaunchCheck(doorId, status.check_id, {
        is_done: !status.is_done,
      });
      onToggled();
    } finally {
      setToggling(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${status.check_name}: ${status.is_done ? "Выполнено" : "Не выполнено"}`}
        className={clsx(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer",
          status.is_done
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-gray-50 border-gray-200 text-gray-500",
        )}
      >
        <span
          className={clsx(
            "inline-block w-1.5 h-1.5 rounded-full",
            status.is_done ? "bg-green-500" : "bg-gray-300",
          )}
        />
        {status.check_name}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[180px]">
          <div className="text-xs font-medium text-gray-700 mb-2">
            {status.check_name}
          </div>
          <button
            onClick={toggle}
            disabled={toggling}
            className={clsx(
              "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              status.is_done
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-staleks-lime text-staleks-sidebar hover:bg-lime-400",
            )}
          >
            {toggling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : status.is_done ? (
              "Снять отметку"
            ) : (
              "Отметить выполненным"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main LaunchView ────────────────────────────────────────────────────────

export function LaunchView() {
  const [doors, setDoors] = useState<PendingDoor[]>([]);
  const [checkDefs, setCheckDefs] = useState<LaunchCheckDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<BatchLaunchResult | null>(null);

  // Filters
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Load check definitions on mount
  useEffect(() => {
    listLaunchChecks().then(setCheckDefs).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPendingDoors({
        check_ids: activeFilters.size > 0 ? [...activeFilters] : undefined,
        priority: priorityFilter || undefined,
        search: search || undefined,
      });
      setDoors(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [activeFilters, priorityFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const allIds = doors.map((d) => d.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const readySelected = [...selected].filter((id) =>
    doors.find((d) => d.id === id)?.is_ready,
  );

  const handleSelectAll = (val: boolean) => {
    setSelected(val ? new Set(allIds) : new Set());
  };

  const handleSelect = (id: string, val: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleLaunch = async () => {
    if (readySelected.length === 0) return;
    setLaunching(true);
    setLaunchResult(null);
    try {
      const result = await batchLaunch(readySelected);
      setLaunchResult(result);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLaunching(false);
    }
  };

  const toggleFilter = (checkId: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(checkId) ? next.delete(checkId) : next.add(checkId);
      return next;
    });
    setSelected(new Set());
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
    setPriorityFilter(false);
    setSearchInput("");
    setSearch("");
    setSelected(new Set());
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setSelected(new Set());
  };

  const hasActiveFilters = activeFilters.size > 0 || priorityFilter || search;

  return (
    <div className="mt-4 space-y-4">
      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4 text-staleks-muted" />
          Фильтры
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-staleks-muted hover:text-gray-700 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Сбросить
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Built-in: Priority */}
          <label
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors",
              priorityFilter
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
            )}
          >
            <input
              type="checkbox"
              checked={priorityFilter}
              onChange={() => {
                setPriorityFilter((v) => !v);
                setSelected(new Set());
              }}
              className="sr-only"
            />
            <Star
              className={clsx(
                "h-3 w-3",
                priorityFilter ? "text-amber-500 fill-amber-400" : "text-gray-400",
              )}
            />
            Приоритет
          </label>

          {/* Dynamic filters from check definitions */}
          {checkDefs.map((cd) => (
            <label
              key={cd.id}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors",
                activeFilters.has(cd.id)
                  ? "bg-staleks-lime/20 border-staleks-lime text-staleks-sidebar"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              <input
                type="checkbox"
                checked={activeFilters.has(cd.id)}
                onChange={() => toggleFilter(cd.id)}
                className="sr-only"
              />
              <span
                className={clsx(
                  "inline-block w-2 h-2 rounded-full",
                  activeFilters.has(cd.id) ? "bg-staleks-lime" : "bg-gray-300",
                )}
              />
              {cd.name}
            </label>
          ))}

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-1.5 ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-staleks-muted" />
              <input
                type="text"
                placeholder="Номер, заказ, клиент..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-staleks-lime w-48"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs bg-staleks-sidebar text-white rounded-lg hover:opacity-90"
            >
              Найти
            </button>
          </form>
        </div>
      </div>

      {/* Stats + Refresh */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-staleks-muted">Всего:</span>
          <span className="font-semibold">{doors.length}</span>
        </div>
        {doors.filter((d) => d.priority).length > 0 && (
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
            <span className="font-semibold text-amber-600">
              {doors.filter((d) => d.priority).length}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-staleks-lime" />
          <span className="text-staleks-muted">Готовы:</span>
          <span className="font-semibold text-staleks-lime">
            {doors.filter((d) => d.is_ready).length}
          </span>
        </div>
        <button
          onClick={load}
          className="ml-auto text-staleks-muted hover:text-gray-700 flex items-center gap-1"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="text-xs">Обновить</span>
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Launch result */}
      {launchResult && (
        <div
          className={clsx(
            "rounded-lg p-3 text-sm border",
            launchResult.total_errors > 0
              ? "bg-yellow-50 border-yellow-200"
              : "bg-green-50 border-green-200",
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            {launchResult.total_errors > 0 ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
            Запущено {launchResult.total_launched} из{" "}
            {launchResult.total_launched + launchResult.total_errors} дверей
          </div>
          {launchResult.errors.map((e, i) => (
            <div key={i} className="mt-1 text-xs text-red-600">
              {e.internal_number ?? e.door_id}: {e.error}
            </div>
          ))}
          <button
            onClick={() => setLaunchResult(null)}
            className="mt-1.5 text-xs text-staleks-muted hover:text-gray-700 underline"
          >
            Скрыть
          </button>
        </div>
      )}

      {/* Toolbar */}
      {doors.length > 0 && (
        <div className="flex items-center gap-3 border rounded-lg px-4 py-2.5 bg-white">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 accent-staleks-lime"
            />
            Выбрать все
          </label>

          {selected.size > 0 && (
            <>
              <span className="text-sm text-staleks-muted">
                Выбрано: {selected.size} (готовы: {readySelected.length})
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleLaunch}
                  disabled={launching || readySelected.length === 0}
                  className={clsx(
                    "flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg font-medium transition-colors",
                    readySelected.length === 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-staleks-lime text-staleks-sidebar hover:bg-lime-400",
                  )}
                >
                  {launching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Запустить ({readySelected.length})
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-staleks-muted" />
        </div>
      )}

      {/* Empty state */}
      {!loading && doors.length === 0 && (
        <div className="text-center py-12 text-staleks-muted">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">
            {hasActiveFilters
              ? "Нет дверей по заданным фильтрам"
              : "Нет дверей в ожидании"}
          </p>
          <p className="text-sm mt-1">
            {hasActiveFilters
              ? "Попробуйте изменить или сбросить фильтры"
              : "Все двери из активных заказов уже запущены"}
          </p>
        </div>
      )}

      {/* Door table */}
      {!loading && doors.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 w-10" />
                <th className="px-3 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                  Номер
                </th>
                <th className="px-3 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                  Маркировка
                </th>
                <th className="px-3 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                  Заказ / Клиент
                </th>
                <th className="px-3 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                  Модель
                </th>
                <th className="px-3 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide">
                  Статус проверок
                </th>
                <th className="px-3 py-3 text-left font-medium text-staleks-muted text-xs uppercase tracking-wide w-20">
                  Готовность
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {doors.map((door) => (
                <tr
                  key={door.id}
                  className={clsx(
                    "hover:bg-white/70 transition-colors",
                    door.priority && "bg-amber-50/40",
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(door.id)}
                      onChange={(e) => handleSelect(door.id, e.target.checked)}
                      className="h-4 w-4 accent-staleks-lime"
                    />
                  </td>

                  {/* Number */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {door.priority && (
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      )}
                      <span className="font-mono font-semibold text-gray-800">
                        {door.internal_number}
                      </span>
                    </div>
                  </td>

                  {/* Marking */}
                  <td className="px-3 py-3 text-gray-600">
                    {door.marking ?? <span className="text-staleks-muted">—</span>}
                  </td>

                  {/* Order / Client */}
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-800">{door.order_number}</div>
                    {door.client_name && (
                      <div className="text-xs text-staleks-muted mt-0.5 truncate max-w-[140px]">
                        {door.client_name}
                      </div>
                    )}
                  </td>

                  {/* Model */}
                  <td className="px-3 py-3 text-gray-600">
                    {door.door_model_label ?? (
                      <span className="text-staleks-muted">—</span>
                    )}
                  </td>

                  {/* Check status pills */}
                  <td className="px-3 py-3">
                    {door.check_statuses.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {door.check_statuses.map((cs) => (
                          <CheckPill
                            key={cs.check_id}
                            status={cs}
                            doorId={door.id}
                            onToggled={load}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-staleks-muted text-xs">—</span>
                    )}
                  </td>

                  {/* Ready */}
                  <td className="px-3 py-3 text-center">
                    {door.is_ready ? (
                      <CheckCircle2 className="h-5 w-5 text-staleks-lime mx-auto" />
                    ) : (
                      <span className="text-xs text-staleks-muted">
                        {door.checks_done}/{door.checks_total}
                      </span>
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
