"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type {
  ConfiguratorCatalog,
  DoorFieldGroup,
  DoorFieldGroupCreate,
  DoorFieldGroupUpdate,
  DoorType,
} from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import { createGroup, updateGroup, deleteGroup } from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui";
import { SectionEditorModal } from "./SectionEditorModal";

interface SectionsTabProps {
  catalog: ConfiguratorCatalog;
  onRefresh: () => void;
}

export function SectionsTab({ catalog, onRefresh }: SectionsTabProps) {
  const [editorSection, setEditorSection] = useState<DoorFieldGroup | null | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<DoorFieldGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sortedGroups = [...catalog.groups].sort((a, b) => a.sort_order - b.sort_order);

  // Count fields per group
  const fieldCountByGroup: Record<string, number> = {};
  for (const field of catalog.field_definitions) {
    fieldCountByGroup[field.group_code] = (fieldCountByGroup[field.group_code] || 0) + 1;
  }

  const handleCreate = () => setEditorSection(null);
  const handleEdit = (section: DoorFieldGroup) => setEditorSection(section);
  const handleCloseEditor = () => setEditorSection(undefined);

  const handleSave = async (data: DoorFieldGroupCreate | DoorFieldGroupUpdate) => {
    if (editorSection === null) {
      // Create mode
      await createGroup(data as DoorFieldGroupCreate);
    } else if (editorSection) {
      // Edit mode
      await updateGroup(editorSection.code, data as DoorFieldGroupUpdate);
    }
    setEditorSection(undefined);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    setError("");
    try {
      await deleteGroup(deleteTarget.code);
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
          <p className="text-sm text-gray-500">{sortedGroups.length} секций</p>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-staleks-muted" />}
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 transition"
        >
          <Plus className="h-4 w-4" />
          Новая секция
        </button>
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
              <th className="px-4 py-3 font-medium text-center">Сортировка</th>
              <th className="px-4 py-3 font-medium">Применимость</th>
              <th className="px-4 py-3 font-medium text-center">Полей</th>
              <th className="px-4 py-3 font-medium text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedGroups.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  Секции не найдены
                </td>
              </tr>
            )}
            {sortedGroups.map((g, idx) => (
              <tr key={g.code} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{g.label}</td>
                <td className="px-4 py-3 text-center text-gray-600">{g.sort_order}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {g.door_type_applicability.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
                      >
                        {DOOR_TYPE_LABELS[t as DoorType] || t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-medium text-gray-700">
                    {fieldCountByGroup[g.code] || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleEdit(g)}
                      className="rounded p-1.5 text-gray-400 hover:text-staleks-sidebar hover:bg-gray-100 transition"
                      title="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(g)}
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

      {/* Section editor modal */}
      {editorSection !== undefined && (
        <SectionEditorModal
          section={editorSection}
          onSave={handleSave}
          onClose={handleCloseEditor}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Удалить секцию"
          message={`Вы действительно хотите удалить секцию "${deleteTarget.label}" (${deleteTarget.code})? Все поля этой секции потеряют привязку.`}
          confirmLabel="Удалить"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
