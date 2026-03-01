"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, GripVertical, Loader2, Check, X } from "lucide-react";
import clsx from "clsx";
import { listStages, createStage, updateStage, reorderStages, listWorkshops } from "@/lib/productionApi";
import type { ProductionStage, ProductionStageCreate, ProductionWorkshop } from "@/types/production";
import { apiError } from "@/lib/utils";
import { ErrorAlert, Modal, Spinner } from "@/components/ui";

interface Props {
  onRefresh?: () => void;
}

export function StagesManagement({ onRefresh }: Props) {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [workshops, setWorkshops] = useState<ProductionWorkshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newWorkshopId, setNewWorkshopId] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editWorkshopId, setEditWorkshopId] = useState("");

  // Drag-and-drop reorder
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stageData, workshopData] = await Promise.all([
        listStages(true),
        listWorkshops(false),
      ]);
      setStages(stageData);
      setWorkshops(workshopData);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload: ProductionStageCreate = {
        code: newCode.trim(),
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        sort_order: (stages.length + 1) * 10,
        workshop_id: newWorkshopId || undefined,
      };
      await createStage(payload);
      setNewCode("");
      setNewName("");
      setNewDesc("");
      setNewWorkshopId("");
      setShowCreate(false);
      await load();
      onRefresh?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (s: ProductionStage) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditDesc(s.description || "");
    setEditActive(s.is_active);
    setEditWorkshopId(s.workshop_id || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      await updateStage(id, {
        name: editName.trim() || undefined,
        description: editDesc.trim() || null,
        is_active: editActive,
        workshop_id: editWorkshopId || null,
      });
      setEditingId(null);
      await load();
      onRefresh?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const reordered = [...stages];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);

    dragItem.current = null;
    dragOverItem.current = null;

    setStages(reordered);
    try {
      await reorderStages(reordered.map((s) => s.id));
      await load();
      onRefresh?.();
    } catch (err) {
      setError(apiError(err));
      await load();
    }
  };

  // Group stages by workshop for visual display
  const workshopMap = new Map(workshops.map((w) => [w.id, w]));

  if (loading) return <Spinner size="lg" />;

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {stages.length} этап{stages.length !== 1 ? "ов" : ""} производства.
          Перетащите для изменения порядка.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-staleks-lime text-staleks-sidebar rounded-lg text-sm font-medium hover:brightness-95 transition"
        >
          <Plus size={16} /> Добавить этап
        </button>
      </div>

      {/* Stages list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {stages.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Этапы не настроены</div>
        ) : (
          stages.map((stage, index) => {
            const workshop = stage.workshop_id ? workshopMap.get(stage.workshop_id) : null;
            return (
              <div
                key={stage.id}
                draggable={editingId !== stage.id}
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 transition",
                  editingId !== stage.id && "cursor-grab hover:bg-gray-50",
                  !stage.is_active && "opacity-50",
                )}
                style={{
                  borderLeft: workshop ? `3px solid ${workshop.color || "#9CA3AF"}` : undefined,
                }}
              >
                <GripVertical size={16} className="text-gray-300 flex-shrink-0" />

                {editingId === stage.id ? (
                  /* Edit mode */
                  <div className="flex-1 flex items-center gap-3 flex-wrap">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-[120px]"
                      placeholder="Название"
                    />
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 min-w-[120px]"
                      placeholder="Описание"
                    />
                    <select
                      value={editWorkshopId}
                      onChange={(e) => setEditWorkshopId(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="">Без цеха</option>
                      {workshops.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                      />
                      Активен
                    </label>
                    <button
                      onClick={() => handleUpdate(stage.id)}
                      disabled={saving}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    </button>
                    <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{stage.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{stage.code}</span>
                        {stage.workshop_name && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: stage.workshop_color || "#9CA3AF" }}
                          >
                            {stage.workshop_name}
                          </span>
                        )}
                        {!stage.is_active && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            неактивен
                          </span>
                        )}
                      </div>
                      {stage.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(stage)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded flex-shrink-0"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
      <Modal onClose={() => setShowCreate(false)} title="Новый этап производства">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="metal_cut"
            />
            <p className="text-xs text-gray-400 mt-1">Латиница, нижнее подчёркивание. Пример: painting</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Покраска"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Опционально"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Цех</label>
            <select
              value={newWorkshopId}
              onChange={(e) => setNewWorkshopId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Без цеха</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Отмена
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !newCode.trim() || !newName.trim()}
              className="px-4 py-2 text-sm bg-staleks-lime text-staleks-sidebar rounded-lg font-medium hover:brightness-95 disabled:opacity-50"
            >
              {saving ? "Создание..." : "Создать"}
            </button>
          </div>
        </div>
      </Modal>
      )}
    </div>
  );
}
