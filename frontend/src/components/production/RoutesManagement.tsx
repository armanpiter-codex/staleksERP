"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, Save, Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import clsx from "clsx";
import { listStages, listAllRoutes, setRouteForModel } from "@/lib/productionApi";
import { listModels } from "@/lib/configuratorApi";
import type { ProductionStage, ProductionRoute, RouteStepInput } from "@/types/production";
import type { DoorModel } from "@/types/configurator";
import { apiError } from "@/lib/utils";
import { ErrorAlert, Spinner } from "@/components/ui";

export function RoutesManagement() {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [models, setModels] = useState<DoorModel[]>([]);
  const [routes, setRoutes] = useState<ProductionRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editing
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [editSteps, setEditSteps] = useState<RouteStepInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stageList, routeList, modelList] = await Promise.all([
        listStages(false),
        listAllRoutes(),
        listModels(),
      ]);
      setStages(stageList);
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
      setEditSteps(
        existing.steps.map((s) => ({
          stage_id: s.stage_id,
          step_order: s.step_order,
          is_optional: s.is_optional,
          notes: s.notes,
        })),
      );
    } else {
      setEditSteps([]);
    }
    setDirty(false);
  };

  const addStep = () => {
    const nextOrder = editSteps.length > 0
      ? Math.max(...editSteps.map((s) => s.step_order)) + 1
      : 1;
    // Find first stage not already in the route
    const usedStageIds = new Set(editSteps.map((s) => s.stage_id));
    const available = stages.find((s) => !usedStageIds.has(s.id));
    if (!available) return;
    setEditSteps([...editSteps, { stage_id: available.id, step_order: nextOrder }]);
    setDirty(true);
  };

  const removeStep = (index: number) => {
    const updated = editSteps.filter((_, i) => i !== index);
    // Renumber
    const renumbered = updated.map((s, i) => ({ ...s, step_order: i + 1 }));
    setEditSteps(renumbered);
    setDirty(true);
  };

  const updateStepStage = (index: number, stageId: string) => {
    const updated = [...editSteps];
    updated[index] = { ...updated[index], stage_id: stageId };
    setEditSteps(updated);
    setDirty(true);
  };

  const toggleOptional = (index: number) => {
    const updated = [...editSteps];
    updated[index] = { ...updated[index], is_optional: !updated[index].is_optional };
    setEditSteps(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedModelId) return;
    setSaving(true);
    setError("");
    try {
      await setRouteForModel(selectedModelId, { steps: editSteps });
      setDirty(false);
      await load();
      // Re-select to refresh
      const existing = (await listAllRoutes()).find((r) => r.door_model_id === selectedModelId);
      if (existing) {
        setEditSteps(
          existing.steps.map((s) => ({
            stage_id: s.stage_id,
            step_order: s.step_order,
            is_optional: s.is_optional,
            notes: s.notes,
          })),
        );
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner size="lg" />;

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const usedStageIds = new Set(editSteps.map((s) => s.stage_id));

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model list */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Модели дверей</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {models.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">Нет моделей</div>
            ) : (
              models.map((model) => {
                const route = routes.find((r) => r.door_model_id === model.id);
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
                        route && route.steps.length > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500",
                      )}>
                        {route && route.steps.length > 0
                          ? `${route.steps.length} шагов`
                          : "нет маршрута"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Route editor */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {selectedModel
                ? `Маршрут: ${selectedModel.label}`
                : "Выберите модель"}
            </h3>
            {selectedModelId && (
              <div className="flex items-center gap-2">
                <button
                  onClick={addStep}
                  disabled={usedStageIds.size >= stages.length}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  <Plus size={14} /> Шаг
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
          ) : editSteps.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              <p>Маршрут не настроен</p>
              <p className="mt-1">
                Нажмите &laquo;+ Шаг&raquo; чтобы добавить этапы производства
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {editSteps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5"
                >
                  <GripVertical size={14} className="text-gray-300" />
                  <span className="text-xs font-mono text-gray-400 w-6">{step.step_order}</span>
                  <ChevronRight size={14} className="text-gray-300" />
                  <select
                    value={step.stage_id}
                    onChange={(e) => updateStepStage(index, e.target.value)}
                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm bg-white"
                  >
                    {stages.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={usedStageIds.has(s.id) && s.id !== step.stage_id}
                      >
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={step.is_optional || false}
                      onChange={() => toggleOptional(index)}
                    />
                    Опц.
                  </label>
                  <button
                    onClick={() => removeStep(index)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Visual preview */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Визуализация маршрута:</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {editSteps.map((step, i) => {
                    const stage = stages.find((s) => s.id === step.stage_id);
                    return (
                      <div key={i} className="flex items-center gap-1">
                        <span
                          className={clsx(
                            "text-xs px-2 py-1 rounded",
                            step.is_optional
                              ? "bg-yellow-50 text-yellow-700 border border-yellow-200 border-dashed"
                              : "bg-staleks-lime/20 text-staleks-sidebar",
                          )}
                        >
                          {stage?.name || "?"}
                        </span>
                        {i < editSteps.length - 1 && (
                          <ChevronRight size={12} className="text-gray-300" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
