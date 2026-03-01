"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  Save,
  Loader2,
  Plus,
  Trash2,
  Copy,
  Layers,
} from "lucide-react";
import clsx from "clsx";
import {
  listStages,
  listWorkshops,
  listAllRoutes,
  setRouteForModel,
} from "@/lib/productionApi";
import { listModels } from "@/lib/configuratorApi";
import type {
  ProductionStage,
  ProductionWorkshop,
  ProductionRoute,
  RoutePhaseInput,
} from "@/types/production";
import type { DoorModel } from "@/types/configurator";
import { apiError } from "@/lib/utils";
import { ErrorAlert, Spinner } from "@/components/ui";

// ─── Local editing types ─────────────────────────────────────────────────────

interface EditStep {
  stage_id: string;
  step_order: number;
  is_optional: boolean;
}

interface EditTrack {
  workshop_id: string;
  stages: EditStep[];
}

interface EditPhase {
  phase: number;
  tracks: EditTrack[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function routeToEditPhases(route: ProductionRoute): EditPhase[] {
  if (!route.phases || route.phases.length === 0) {
    // Legacy flat route — wrap into single phase
    if (route.steps.length === 0) return [];
    const byWorkshop = new Map<string, EditStep[]>();
    for (const s of route.steps) {
      const wid = s.workshop_id || "__none__";
      if (!byWorkshop.has(wid)) byWorkshop.set(wid, []);
      byWorkshop.get(wid)!.push({
        stage_id: s.stage_id,
        step_order: s.step_order,
        is_optional: s.is_optional,
      });
    }
    const tracks: EditTrack[] = [];
    for (const [wid, steps] of byWorkshop) {
      tracks.push({ workshop_id: wid === "__none__" ? "" : wid, stages: steps });
    }
    return [{ phase: 1, tracks }];
  }

  return route.phases.map((p) => ({
    phase: p.phase,
    tracks: p.tracks.map((t) => ({
      workshop_id: t.workshop_id,
      stages: t.steps.map((s) => ({
        stage_id: s.stage_id,
        step_order: s.step_order,
        is_optional: s.is_optional,
      })),
    })),
  }));
}

function editPhasesToPayload(phases: EditPhase[]): RoutePhaseInput[] {
  return phases.flatMap((p) =>
    p.tracks.map((t) => ({
      phase: p.phase,
      workshop_id: t.workshop_id,
      stages: t.stages.map((s, i) => ({
        stage_id: s.stage_id,
        step_order: i + 1,
        is_optional: s.is_optional,
      })),
    })),
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RoutesManagement() {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [workshops, setWorkshops] = useState<ProductionWorkshop[]>([]);
  const [models, setModels] = useState<DoorModel[]>([]);
  const [routes, setRoutes] = useState<ProductionRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editing
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [editPhases, setEditPhases] = useState<EditPhase[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stageList, workshopList, routeList, modelList] = await Promise.all([
        listStages(false),
        listWorkshops(false),
        listAllRoutes(),
        listModels(),
      ]);
      setStages(stageList);
      setWorkshops(workshopList);
      setRoutes(routeList);
      setModels(modelList.filter((m) => m.is_active));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectModel = (modelId: string) => {
    setSelectedModelId(modelId);
    const existing = routes.find((r) => r.door_model_id === modelId);
    if (existing) {
      setEditPhases(routeToEditPhases(existing));
    } else {
      setEditPhases([]);
    }
    setDirty(false);
  };

  // ─── Phase operations ────────────────────────────────────────────────────

  const addPhase = () => {
    const nextPhase = editPhases.length > 0
      ? Math.max(...editPhases.map((p) => p.phase)) + 1
      : 1;
    const usedWorkshopIds = new Set(editPhases.flatMap((p) => p.tracks.map((t) => t.workshop_id)));
    const availableWorkshop = workshops.find((w) => !usedWorkshopIds.has(w.id));
    setEditPhases([
      ...editPhases,
      {
        phase: nextPhase,
        tracks: [
          {
            workshop_id: availableWorkshop?.id || workshops[0]?.id || "",
            stages: [],
          },
        ],
      },
    ]);
    setDirty(true);
  };

  const removePhase = (phaseIndex: number) => {
    const updated = editPhases.filter((_, i) => i !== phaseIndex);
    const renumbered = updated.map((p, i) => ({ ...p, phase: i + 1 }));
    setEditPhases(renumbered);
    setDirty(true);
  };

  // ─── Track operations ────────────────────────────────────────────────────

  const addTrack = (phaseIndex: number) => {
    const phase = editPhases[phaseIndex];
    const usedInPhase = new Set(phase.tracks.map((t) => t.workshop_id));
    const available = workshops.find((w) => !usedInPhase.has(w.id));
    if (!available) return;

    const updated = [...editPhases];
    updated[phaseIndex] = {
      ...phase,
      tracks: [
        ...phase.tracks,
        { workshop_id: available.id, stages: [] },
      ],
    };
    setEditPhases(updated);
    setDirty(true);
  };

  const removeTrack = (phaseIndex: number, trackIndex: number) => {
    const updated = [...editPhases];
    const phase = { ...updated[phaseIndex] };
    phase.tracks = phase.tracks.filter((_, i) => i !== trackIndex);
    if (phase.tracks.length === 0) {
      removePhase(phaseIndex);
    } else {
      updated[phaseIndex] = phase;
      setEditPhases(updated);
      setDirty(true);
    }
  };

  const updateTrackWorkshop = (phaseIndex: number, trackIndex: number, workshopId: string) => {
    const updated = [...editPhases];
    const phase = { ...updated[phaseIndex] };
    const tracks = [...phase.tracks];
    tracks[trackIndex] = { ...tracks[trackIndex], workshop_id: workshopId };
    phase.tracks = tracks;
    updated[phaseIndex] = phase;
    setEditPhases(updated);
    setDirty(true);
  };

  // ─── Step operations ─────────────────────────────────────────────────────

  const addStep = (phaseIndex: number, trackIndex: number) => {
    const track = editPhases[phaseIndex].tracks[trackIndex];
    const usedStageIds = new Set(track.stages.map((s) => s.stage_id));
    const available = stages.find((s) => !usedStageIds.has(s.id));
    if (!available) return;

    const nextOrder = track.stages.length > 0
      ? Math.max(...track.stages.map((s) => s.step_order)) + 1
      : 1;

    const updated = [...editPhases];
    const phase = { ...updated[phaseIndex] };
    const tracks = [...phase.tracks];
    tracks[trackIndex] = {
      ...tracks[trackIndex],
      stages: [
        ...tracks[trackIndex].stages,
        { stage_id: available.id, step_order: nextOrder, is_optional: false },
      ],
    };
    phase.tracks = tracks;
    updated[phaseIndex] = phase;
    setEditPhases(updated);
    setDirty(true);
  };

  const removeStep = (phaseIndex: number, trackIndex: number, stepIndex: number) => {
    const updated = [...editPhases];
    const phase = { ...updated[phaseIndex] };
    const tracks = [...phase.tracks];
    const track = { ...tracks[trackIndex] };
    track.stages = track.stages.filter((_, i) => i !== stepIndex)
      .map((s, i) => ({ ...s, step_order: i + 1 }));
    tracks[trackIndex] = track;
    phase.tracks = tracks;
    updated[phaseIndex] = phase;
    setEditPhases(updated);
    setDirty(true);
  };

  const updateStepStage = (
    phaseIndex: number,
    trackIndex: number,
    stepIndex: number,
    stageId: string,
  ) => {
    const updated = [...editPhases];
    const phase = { ...updated[phaseIndex] };
    const tracks = [...phase.tracks];
    const track = { ...tracks[trackIndex] };
    const stepsCopy = [...track.stages];
    stepsCopy[stepIndex] = { ...stepsCopy[stepIndex], stage_id: stageId };
    track.stages = stepsCopy;
    tracks[trackIndex] = track;
    phase.tracks = tracks;
    updated[phaseIndex] = phase;
    setEditPhases(updated);
    setDirty(true);
  };

  const toggleOptional = (phaseIndex: number, trackIndex: number, stepIndex: number) => {
    const updated = [...editPhases];
    const phase = { ...updated[phaseIndex] };
    const tracks = [...phase.tracks];
    const track = { ...tracks[trackIndex] };
    const stepsCopy = [...track.stages];
    stepsCopy[stepIndex] = { ...stepsCopy[stepIndex], is_optional: !stepsCopy[stepIndex].is_optional };
    track.stages = stepsCopy;
    tracks[trackIndex] = track;
    phase.tracks = tracks;
    updated[phaseIndex] = phase;
    setEditPhases(updated);
    setDirty(true);
  };

  // ─── Save ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedModelId) return;
    setSaving(true);
    setError("");
    try {
      const payload = editPhasesToPayload(editPhases);
      await setRouteForModel(selectedModelId, { phases: payload });
      setDirty(false);
      await load();
      const updated = (await listAllRoutes()).find((r) => r.door_model_id === selectedModelId);
      if (updated) {
        setEditPhases(routeToEditPhases(updated));
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── Copy from another model ─────────────────────────────────────────────

  const copyFromModel = (sourceModelId: string) => {
    const source = routes.find((r) => r.door_model_id === sourceModelId);
    if (!source) return;
    setEditPhases(routeToEditPhases(source));
    setDirty(true);
  };

  const modelsWithRoutes = models.filter(
    (m) => m.id !== selectedModelId && routes.some((r) => r.door_model_id === m.id && r.steps.length > 0),
  );

  if (loading) return <Spinner size="lg" />;

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const workshopMap = new Map(workshops.map((w) => [w.id, w]));

  const totalSteps = editPhases.reduce(
    (sum, p) => sum + p.tracks.reduce((ts, t) => ts + t.stages.length, 0),
    0,
  );

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model list */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Модели дверей</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {models.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">Нет моделей</div>
            ) : (
              models.map((model) => {
                const route = routes.find((r) => r.door_model_id === model.id);
                const stepCount = route?.steps.length || 0;
                return (
                  <button
                    key={model.id}
                    onClick={() => selectModel(model.id)}
                    className={clsx(
                      "w-full text-left px-4 py-3 transition hover:bg-gray-50",
                      selectedModelId === model.id && "bg-lime-50 border-l-2 border-staleks-lime",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{model.label}</span>
                        <span className="text-xs text-gray-400 ml-2">{model.code}</span>
                      </div>
                      <span className={clsx(
                        "text-xs px-2 py-0.5 rounded-full",
                        stepCount > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500",
                      )}>
                        {stepCount > 0
                          ? `${stepCount} шагов`
                          : "нет маршрута"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Phase-based route editor */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {selectedModel
                ? `Маршрут: ${selectedModel.label}`
                : "Выберите модель"}
            </h3>
            {selectedModelId && (
              <div className="flex items-center gap-2">
                {modelsWithRoutes.length > 0 && (
                  <div className="relative">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) copyFromModel(e.target.value);
                      }}
                      className="appearance-none text-xs border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 bg-white text-gray-600 hover:border-gray-300 cursor-pointer"
                    >
                      <option value="">Копировать из...</option>
                      {modelsWithRoutes.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.code})
                        </option>
                      ))}
                    </select>
                    <Copy size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}
                <button
                  onClick={addPhase}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <Layers size={14} /> Фаза
                </button>
                {dirty && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-staleks-lime text-staleks-sidebar rounded-lg hover:brightness-95"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Сохранить
                  </button>
                )}
              </div>
            )}
          </div>

          {!selectedModelId ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              Выберите модель двери слева для настройки маршрута
            </div>
          ) : editPhases.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              <p>Маршрут не настроен</p>
              <p className="mt-1">
                Нажмите &laquo;+ Фаза&raquo; чтобы начать настройку маршрута
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {editPhases.map((phase, phaseIdx) => (
                <div
                  key={phaseIdx}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Phase header */}
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">
                        Фаза {phase.phase}
                      </span>
                      {phase.tracks.length > 1 && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          параллельно
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => addTrack(phaseIdx)}
                        disabled={phase.tracks.length >= workshops.length}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30"
                      >
                        <Plus size={12} /> Цех
                      </button>
                      <button
                        onClick={() => removePhase(phaseIdx)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Tracks */}
                  <div className={clsx(
                    "divide-y divide-gray-100",
                    phase.tracks.length > 1 && "bg-blue-50/30",
                  )}>
                    {phase.tracks.map((track, trackIdx) => {
                      const workshop = workshopMap.get(track.workshop_id);
                      const usedInTrack = new Set(track.stages.map((s) => s.stage_id));

                      return (
                        <div
                          key={trackIdx}
                          className="p-3"
                          style={{
                            borderLeft: workshop ? `3px solid ${workshop.color || "#9CA3AF"}` : undefined,
                          }}
                        >
                          {/* Track header */}
                          <div className="flex items-center gap-2 mb-2">
                            <select
                              value={track.workshop_id}
                              onChange={(e) => updateTrackWorkshop(phaseIdx, trackIdx, e.target.value)}
                              className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
                            >
                              <option value="">Выберите цех</option>
                              {workshops.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => addStep(phaseIdx, trackIdx)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                            >
                              <Plus size={12} /> Этап
                            </button>
                            {phase.tracks.length > 1 && (
                              <button
                                onClick={() => removeTrack(phaseIdx, trackIdx)}
                                className="ml-auto p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>

                          {/* Steps */}
                          {track.stages.length === 0 ? (
                            <p className="text-xs text-gray-400 pl-2">
                              Нажмите &laquo;+ Этап&raquo; для добавления
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {track.stages.map((step, stepIdx) => (
                                <div
                                  key={stepIdx}
                                  className="flex items-center gap-2 bg-white rounded px-2 py-1.5 border border-gray-100"
                                >
                                  <span className="text-xs font-mono text-gray-400 w-5">
                                    {step.step_order}
                                  </span>
                                  <ChevronRight size={12} className="text-gray-300" />
                                  <select
                                    value={step.stage_id}
                                    onChange={(e) =>
                                      updateStepStage(phaseIdx, trackIdx, stepIdx, e.target.value)
                                    }
                                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                                  >
                                    {stages.map((s) => (
                                      <option
                                        key={s.id}
                                        value={s.id}
                                        disabled={usedInTrack.has(s.id) && s.id !== step.stage_id}
                                      >
                                        {s.name} ({s.code})
                                        {s.workshop_name ? ` — ${s.workshop_name}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={step.is_optional}
                                      onChange={() => toggleOptional(phaseIdx, trackIdx, stepIdx)}
                                    />
                                    Опц.
                                  </label>
                                  <button
                                    onClick={() => removeStep(phaseIdx, trackIdx, stepIdx)}
                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Visual preview */}
              {totalSteps > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-3">Визуализация маршрута:</p>
                  <div className="space-y-3">
                    {editPhases.map((phase, phaseIdx) => (
                      <div key={phaseIdx}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-gray-500">
                            Фаза {phase.phase}
                          </span>
                          {phase.tracks.length > 1 && (
                            <span className="text-[10px] text-blue-500">параллельно</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {phase.tracks.map((track, trackIdx) => {
                            const workshop = workshopMap.get(track.workshop_id);
                            return (
                              <div key={trackIdx} className="flex items-center gap-1 flex-wrap">
                                {workshop && (
                                  <span
                                    className="text-[10px] text-white px-1.5 py-0.5 rounded mr-1"
                                    style={{ backgroundColor: workshop.color || "#9CA3AF" }}
                                  >
                                    {workshop.name}
                                  </span>
                                )}
                                {track.stages.map((step, i) => {
                                  const stage = stages.find((s) => s.id === step.stage_id);
                                  return (
                                    <div key={i} className="flex items-center gap-1">
                                      <span
                                        className={clsx(
                                          "text-xs px-2 py-0.5 rounded",
                                          step.is_optional
                                            ? "bg-yellow-50 text-yellow-700 border border-yellow-200 border-dashed"
                                            : "bg-staleks-lime/20 text-staleks-sidebar",
                                        )}
                                      >
                                        {stage?.name || "?"}
                                      </span>
                                      {i < track.stages.length - 1 && (
                                        <ChevronRight size={10} className="text-gray-300" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                        {phaseIdx < editPhases.length - 1 && (
                          <div className="flex items-center gap-2 mt-2 mb-1">
                            <div className="flex-1 border-t border-dashed border-gray-300" />
                            <span className="text-[10px] text-gray-400">все треки завершены</span>
                            <div className="flex-1 border-t border-dashed border-gray-300" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
