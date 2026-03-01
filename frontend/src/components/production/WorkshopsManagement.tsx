"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, GripVertical, Loader2, Check, X } from "lucide-react";
import clsx from "clsx";
import { listWorkshops, createWorkshop, updateWorkshop, reorderWorkshops } from "@/lib/productionApi";
import type { ProductionWorkshop, ProductionWorkshopCreate } from "@/types/production";
import { apiError } from "@/lib/utils";
import { ErrorAlert, Modal, Spinner } from "@/components/ui";

const PRESET_COLORS = [
  "#EF4444", "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6",
  "#EC4899", "#F97316", "#06B6D4", "#84CC16", "#6366F1",
];

interface Props {
  onRefresh?: () => void;
}

export function WorkshopsManagement({ onRefresh }: Props) {
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
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editActive, setEditActive] = useState(true);

  // Drag-and-drop reorder
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listWorkshops(true);
      setWorkshops(data);
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
      const payload: ProductionWorkshopCreate = {
        code: newCode.trim(),
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        color: newColor || undefined,
        sort_order: (workshops.length + 1) * 10,
      };
      await createWorkshop(payload);
      setNewCode("");
      setNewName("");
      setNewDesc("");
      setNewColor(PRESET_COLORS[0]);
      setShowCreate(false);
      await load();
      onRefresh?.();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (w: ProductionWorkshop) => {
    setEditingId(w.id);
    setEditName(w.name);
    setEditDesc(w.description || "");
    setEditColor(w.color || "");
    setEditActive(w.is_active);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      await updateWorkshop(id, {
        name: editName.trim() || undefined,
        description: editDesc.trim() || null,
        color: editColor || null,
        is_active: editActive,
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

    const reordered = [...workshops];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);

    dragItem.current = null;
    dragOverItem.current = null;

    setWorkshops(reordered);
    try {
      await reorderWorkshops(reordered.map((w) => w.id));
      await load();
      onRefresh?.();
    } catch (err) {
      setError(apiError(err));
      await load();
    }
  };

  if (loading) return <Spinner size="lg" />;

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {workshops.length} цех{workshops.length !== 1 ? "ов" : ""}.
          Перетащите для изменения порядка.
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-staleks-lime text-staleks-sidebar rounded-lg text-sm font-medium hover:brightness-95 transition"
        >
          <Plus size={16} /> Добавить цех
        </button>
      </div>

      {/* Workshops list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {workshops.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Цеха не настроены</div>
        ) : (
          workshops.map((workshop, index) => (
            <div
              key={workshop.id}
              draggable={editingId !== workshop.id}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 transition",
                editingId !== workshop.id && "cursor-grab hover:bg-gray-50",
                !workshop.is_active && "opacity-50",
              )}
            >
              <GripVertical size={16} className="text-gray-300 flex-shrink-0" />

              {/* Color indicator */}
              <div
                className="w-3 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: workshop.color || "#9CA3AF" }}
              />

              {editingId === workshop.id ? (
                /* Edit mode */
                <div className="flex-1 flex items-center gap-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                    placeholder="Название"
                  />
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                    placeholder="Описание"
                  />
                  <div className="flex items-center gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={clsx(
                          "w-5 h-5 rounded-full border-2 transition",
                          editColor === c ? "border-gray-800 scale-110" : "border-transparent",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                    />
                    Активен
                  </label>
                  <button
                    onClick={() => handleUpdate(workshop.id)}
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
                      <span className="font-medium text-sm">{workshop.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{workshop.code}</span>
                      {!workshop.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          неактивен
                        </span>
                      )}
                    </div>
                    {workshop.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{workshop.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(workshop)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded flex-shrink-0"
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
      <Modal onClose={() => setShowCreate(false)} title="Новый цех">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="glass"
            />
            <p className="text-xs text-gray-400 mt-1">Латиница, нижнее подчёркивание. Пример: metal</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Стекло"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={clsx(
                    "w-7 h-7 rounded-full border-2 transition",
                    newColor === c ? "border-gray-800 scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
