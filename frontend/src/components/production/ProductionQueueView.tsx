"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Star,
  Clock,
  Loader2,
  X,
  Printer,
} from "lucide-react";
import clsx from "clsx";
import {
  getProductionQueue,
  listStages,
  moveDoorNext,
  moveDoorPrev,
  getDoorHistory,
  getDoorPrintData,
  getStagePrintData,
} from "@/lib/productionApi";
import type {
  ProductionDoor,
  StageCounter,
  WorkshopCounter,
  ProductionStage,
  DoorStageHistory,
  QueueParams,
  DoorPrintData,
  StagePrintData,
} from "@/types/production";
import { apiError, fmtDate } from "@/lib/utils";
import { ErrorAlert, Spinner, Modal } from "@/components/ui";
import { DoorPrintCard } from "./DoorPrintCard";
import { StagePrintSummary } from "./StagePrintSummary";

export function ProductionQueueView() {
  const [doors, setDoors] = useState<ProductionDoor[]>([]);
  const [counters, setCounters] = useState<StageCounter[]>([]);
  const [workshopCounters, setWorkshopCounters] = useState<WorkshopCounter[]>([]);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [stageFilter, setStageFilter] = useState<string>("");
  const [workshopFilter, setWorkshopFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Movement
  const [movingDoorId, setMovingDoorId] = useState<string | null>(null);

  // History modal
  const [historyDoorId, setHistoryDoorId] = useState<string | null>(null);
  const [historyDoorNumber, setHistoryDoorNumber] = useState("");
  const [history, setHistory] = useState<DoorStageHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Print overlays
  const [doorPrintData, setDoorPrintData] = useState<DoorPrintData | null>(null);
  const [stagePrintData, setStagePrintData] = useState<StagePrintData | null>(null);
  const [printLoading, setPrintLoading] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: QueueParams = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (stageFilter) params.stage_id = stageFilter;
      if (workshopFilter) params.workshop_id = workshopFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (priorityFilter !== undefined) params.priority = priorityFilter;

      const [queueData, stageList] = await Promise.all([
        getProductionQueue(params),
        stages.length === 0 ? listStages(false) : Promise.resolve(stages),
      ]);

      setDoors(queueData.items);
      setCounters(queueData.counters);
      setWorkshopCounters(queueData.workshop_counters || []);
      setTotal(queueData.total);
      if (stages.length === 0) setStages(stageList as ProductionStage[]);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [page, stageFilter, workshopFilter, searchQuery, priorityFilter, stages]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleMoveNext = async (doorId: string, workshopId?: string) => {
    setMovingDoorId(doorId);
    try {
      await moveDoorNext(doorId, workshopId ? { workshop_id: workshopId } : undefined);
      await loadQueue();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setMovingDoorId(null);
    }
  };

  const handleMovePrev = async (doorId: string, workshopId?: string) => {
    setMovingDoorId(doorId);
    try {
      await moveDoorPrev(doorId, workshopId ? { workshop_id: workshopId } : undefined);
      await loadQueue();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setMovingDoorId(null);
    }
  };

  const openHistory = async (door: ProductionDoor) => {
    setHistoryDoorId(door.door_id);
    setHistoryDoorNumber(door.internal_number);
    setHistoryLoading(true);
    try {
      const data = await getDoorHistory(door.door_id);
      setHistory(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryDoorId(null);
    setHistory([]);
  };

  const openDoorPrint = async (doorId: string) => {
    setPrintLoading(doorId);
    try {
      const data = await getDoorPrintData(doorId);
      setDoorPrintData(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setPrintLoading(null);
    }
  };

  const openStagePrint = async () => {
    if (!stageFilter) return;
    setPrintLoading("stage");
    try {
      const data = await getStagePrintData(stageFilter);
      setStagePrintData(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setPrintLoading(null);
    }
  };

  const resetFilters = () => {
    setStageFilter("");
    setWorkshopFilter("");
    setSearchQuery("");
    setPriorityFilter(undefined);
    setPage(0);
  };

  const hasFilters = stageFilter || workshopFilter || searchQuery || priorityFilter !== undefined;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totalCount = counters.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Workshop counters (grouping by workshop) */}
      {workshopCounters.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setWorkshopFilter(""); setStageFilter(""); setPage(0); }}
            className={clsx(
              "px-3 py-2 rounded-lg text-sm font-medium border transition",
              !workshopFilter && !stageFilter
                ? "bg-staleks-lime text-staleks-sidebar border-staleks-lime"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
            )}
          >
            Все ({totalCount})
          </button>
          {workshopCounters.map((wc) => (
            <button
              key={wc.workshop_id || "none"}
              onClick={() => {
                setWorkshopFilter(wc.workshop_id || "");
                setStageFilter("");
                setPage(0);
              }}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition",
                workshopFilter === (wc.workshop_id || "")
                  ? "text-staleks-sidebar border-transparent"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
              )}
              style={
                workshopFilter === (wc.workshop_id || "")
                  ? { backgroundColor: wc.workshop_color || "#C0DF16", borderColor: wc.workshop_color || "#C0DF16" }
                  : {}
              }
            >
              {wc.workshop_color && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: wc.workshop_color }}
                />
              )}
              {wc.workshop_name} ({wc.count})
            </button>
          ))}
        </div>
      )}

      {/* Stage counters (when workshop selected or no workshops) */}
      {(workshopFilter || workshopCounters.length === 0) && counters.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setStageFilter(""); setPage(0); }}
            className={clsx(
              "px-3 py-2 rounded-lg text-sm font-medium border transition",
              !stageFilter
                ? "bg-staleks-lime text-staleks-sidebar border-staleks-lime"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
            )}
          >
            Все этапы ({counters.reduce((s, c) => s + c.count, 0)})
          </button>
          {counters
            .filter((c) => !workshopFilter || c.workshop_id === workshopFilter || !c.workshop_id)
            .map((counter) => (
              <button
                key={counter.stage_id || "none"}
                onClick={() => {
                  setStageFilter(counter.stage_id || "");
                  setPage(0);
                }}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition",
                  stageFilter === (counter.stage_id || "")
                    ? "bg-staleks-lime text-staleks-sidebar border-staleks-lime"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
                )}
              >
                {counter.workshop_color && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: counter.workshop_color }}
                  />
                )}
                {counter.stage_name} ({counter.count})
              </button>
            ))}
        </div>
      )}

      {/* Search & filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Поиск по номеру, маркировке, заказу..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={() => {
            setPriorityFilter(priorityFilter === true ? undefined : true);
            setPage(0);
          }}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition",
            priorityFilter === true
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300",
          )}
        >
          <Star size={14} /> Срочные
        </button>
        {stageFilter && (
          <button
            onClick={openStagePrint}
            disabled={printLoading === "stage"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
          >
            {printLoading === "stage" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Printer size={14} />
            )}
            Печать списка
          </button>
        )}
        {hasFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <X size={14} /> Сбросить
          </button>
        )}
      </div>

      {/* Queue table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8"><Spinner size="lg" /></div>
        ) : doors.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {hasFilters
              ? "Нет дверей по заданным фильтрам"
              : "Нет дверей в производстве"}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Номер</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Маркировка</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Заказ</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Модель</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Этапы / Цеха</th>
                  <th className="text-center px-4 py-2.5 font-medium text-gray-500">Прогресс</th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {doors.map((door) => {
                  const hasParallel = door.workshop_progress && door.workshop_progress.length > 1;
                  const activeProgress = door.workshop_progress?.filter((p) => p.status === "active") || [];

                  return (
                    <tr
                      key={door.door_id}
                      className={clsx(
                        "hover:bg-gray-50 transition",
                        door.priority && "bg-amber-50/50",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {door.priority && <Star size={12} className="text-amber-500 fill-amber-500" />}
                          <span className="font-mono font-medium">{door.internal_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{door.marking || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-blue-600">{door.order_number}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{door.door_model_label || "—"}</td>
                      <td className="px-4 py-3">
                        {hasParallel && activeProgress.length > 0 ? (
                          /* Multi-track parallel display */
                          <div className="space-y-1">
                            {activeProgress.map((prog) => (
                              <div key={prog.workshop_id} className="flex items-center gap-1.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: prog.workshop_color || "#9CA3AF" }}
                                />
                                <span className="text-xs text-gray-500">{prog.workshop_name}:</span>
                                {prog.current_stage_name ? (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white"
                                    style={{ backgroundColor: prog.workshop_color || "#6B7280" }}
                                  >
                                    {prog.current_stage_name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : door.current_stage_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-staleks-lime/20 text-staleks-sidebar">
                            {door.current_stage_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Без этапа</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasParallel && activeProgress.length > 0 ? (
                          /* Per-track progress bars */
                          <div className="space-y-1 min-w-[100px]">
                            {activeProgress.map((prog) => (
                              <div key={prog.workshop_id} className="flex items-center gap-1.5">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      backgroundColor: prog.workshop_color || "#C0DF16",
                                      width: prog.track_total_steps > 0
                                        ? `${(prog.track_current_step / prog.track_total_steps) * 100}%`
                                        : "0%",
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400">
                                  {prog.track_current_step}/{prog.track_total_steps}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : door.route_total_steps > 0 ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-staleks-lime rounded-full transition-all"
                                style={{
                                  width: `${(door.route_current_step / door.route_total_steps) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {door.route_current_step}/{door.route_total_steps}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs text-center block">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {hasParallel && activeProgress.length > 1 ? (
                            /* Per-workshop movement buttons */
                            <div className="flex items-center gap-1">
                              {activeProgress.map((prog) => (
                                <button
                                  key={prog.workshop_id}
                                  onClick={() => handleMoveNext(door.door_id, prog.workshop_id)}
                                  disabled={movingDoorId === door.door_id}
                                  title={`Далее (${prog.workshop_name})`}
                                  className="p-1.5 rounded disabled:opacity-30 text-white text-xs"
                                  style={{ backgroundColor: prog.workshop_color || "#6B7280" }}
                                >
                                  {movingDoorId === door.door_id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <ArrowRight size={12} />
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleMovePrev(door.door_id)}
                                disabled={movingDoorId === door.door_id || door.route_current_step <= 1}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                title="Назад"
                              >
                                {movingDoorId === door.door_id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <ChevronLeft size={14} />
                                )}
                              </button>
                              <button
                                onClick={() => handleMoveNext(door.door_id)}
                                disabled={movingDoorId === door.door_id}
                                className="p-1.5 text-staleks-sidebar hover:bg-staleks-lime/20 rounded disabled:opacity-30"
                                title="Далее"
                              >
                                {movingDoorId === door.door_id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <ArrowRight size={14} />
                                )}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openHistory(door)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="История"
                          >
                            <Clock size={14} />
                          </button>
                          <button
                            onClick={() => openDoorPrint(door.door_id)}
                            disabled={printLoading === door.door_id}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30"
                            title="Печать карточки"
                          >
                            {printLoading === door.door_id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Printer size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  Показано {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} из {total}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-2.5 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Далее
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Print overlays */}
      {doorPrintData && (
        <DoorPrintCard data={doorPrintData} onClose={() => setDoorPrintData(null)} />
      )}
      {stagePrintData && (
        <StagePrintSummary data={stagePrintData} onClose={() => setStagePrintData(null)} />
      )}

      {/* History modal */}
      {historyDoorId && (
        <Modal
          onClose={closeHistory}
          title={`История: ${historyDoorNumber}`}
        >
          {historyLoading ? (
            <Spinner size="md" />
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Нет записей</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <ArrowRight size={14} className="text-staleks-lime mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {entry.from_stage_name ? (
                        <>
                          <span className="text-gray-500">{entry.from_stage_name}</span>
                          <ChevronRight size={12} className="text-gray-300" />
                        </>
                      ) : null}
                      <span className="font-medium">{entry.to_stage_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{entry.moved_by_name}</span>
                      <span>{fmtDate(entry.moved_at)}</span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
