"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type {
  ConfiguratorCatalog,
  DoorModel,
  DoorModelCreate,
  DoorModelUpdate,
  DoorType,
} from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import { createModel, updateModel, deleteModel } from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui";
import { ModelEditorModal } from "./ModelEditorModal";

interface ModelsTabProps {
  catalog: ConfiguratorCatalog;
  onRefresh: () => void;
}

export function ModelsTab({ catalog, onRefresh }: ModelsTabProps) {
  const [typeFilter, setTypeFilter] = useState<DoorType | "">("");
  const [editorModel, setEditorModel] = useState<DoorModel | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DoorModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredModels = typeFilter
    ? catalog.models.filter((m) => m.door_type === typeFilter)
    : catalog.models;

  const sortedModels = [...filteredModels].sort((a, b) => a.sort_order - b.sort_order);

  const handleCreate = () => setEditorModel(null);
  const handleEdit = (model: DoorModel) => setEditorModel(model);
  const handleCloseEditor = () => setEditorModel(undefined);

  const handleSave = async (data: DoorModelCreate | DoorModelUpdate) => {
    if (editorModel === null) {
      // Create mode
      await createModel(data as DoorModelCreate);
    } else if (editorModel) {
      // Edit mode
      await updateModel(editorModel.code, data as DoorModelUpdate);
    }
    setEditorModel(undefined);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError("");
    try {
      await deleteModel(deleteTarget.code);
      setDeleteTarget(null);
      onRefresh();
    } catch (err) {
      setError(apiError(err));
      setDeleteTarget(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{sortedModels.length} моделей</p>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-staleks-muted" />}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DoorType | "")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          >
            <option value="">Все типы</option>
            <option value="technical">Техническая</option>
            <option value="finish">С отделкой</option>
          </select>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 transition"
          >
            <Plus className="h-4 w-4" />
            Новая модель
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-staleks-error">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium w-8">#</th>
              <th className="px-4 py-3 font-medium">Код</th>
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Сокращение</th>
              <th className="px-4 py-3 font-medium">Тип</th>
              <th className="px-4 py-3 font-medium text-center">Сортировка</th>
              <th className="px-4 py-3 font-medium">Особенности</th>
              <th className="px-4 py-3 font-medium text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedModels.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  Модели не найдены
                </td>
              </tr>
            )}
            {sortedModels.map((m, idx) => (
              <tr key={m.code} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{m.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{m.label}</td>
                <td className="px-4 py-3 text-gray-600">{m.label_short || "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    {DOOR_TYPE_LABELS[m.door_type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{m.sort_order}</td>
                <td className="px-4 py-3">
                  {m.no_exterior && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Без нар. отделки
                    </span>
                  )}
                  {!m.is_active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 ml-1">
                      Неактивна
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(m)}
                      className="rounded p-1.5 text-gray-400 hover:text-staleks-sidebar hover:bg-gray-100 transition"
                      title="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      className="rounded p-1.5 text-gray-400 hover:text-staleks-error hover:bg-red-50 transition"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Model editor modal */}
      {editorModel !== undefined && (
        <ModelEditorModal
          model={editorModel}
          onSave={handleSave}
          onClose={handleCloseEditor}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Удалить модель"
          message={`Вы действительно хотите удалить модель "${deleteTarget.label}" (${deleteTarget.code})? Это действие необратимо.`}
          confirmLabel="Удалить"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
