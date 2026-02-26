"use client";

import { useState } from "react";
import { Search, Plus, Edit2, Eye, EyeOff } from "lucide-react";
import clsx from "clsx";
import type { DoorFieldDefinition, DoorType } from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import { FIELD_TYPE_LABELS } from "./constants";
import { FieldEditorModal } from "./FieldEditorModal";

interface FieldsTabProps {
  fields: DoorFieldDefinition[];
  groups: Array<{ code: string; label: string }>;
  onRefresh: () => void;
}

export function FieldsTab({ fields, groups, onRefresh }: FieldsTabProps) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<DoorType | "">("");
  const [editField, setEditField] = useState<DoorFieldDefinition | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = fields.filter((f) => {
    if (search && !f.label.toLowerCase().includes(search.toLowerCase()) && !f.code.toLowerCase().includes(search.toLowerCase())) return false;
    if (groupFilter && f.group_code !== groupFilter) return false;
    if (typeFilter && !f.door_type_applicability.includes(typeFilter)) return false;
    return true;
  });

  const grouped = groups
    .map((g) => ({
      ...g,
      fields: filtered.filter((f) => f.group_code === g.code).sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((g) => g.fields.length > 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию или коду..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          />
        </div>
        <div className="flex items-center gap-2">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime">
            <option value="">Все секции</option>
            {groups.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as DoorType | "")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime">
            <option value="">Все типы</option>
            <option value="technical">Техническая</option>
            <option value="finish">С Отделкой</option>
          </select>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 transition">
            <Plus className="h-4 w-4" />
            Новое поле
          </button>
        </div>
      </div>

      {/* Grouped fields */}
      {grouped.map((g) => (
        <div key={g.code} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {g.label} ({g.fields.length})
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium w-8">#</th>
                <th className="px-4 py-2 font-medium">Код</th>
                <th className="px-4 py-2 font-medium">Название</th>
                <th className="px-4 py-2 font-medium">Тип</th>
                <th className="px-4 py-2 font-medium">Слой</th>
                <th className="px-4 py-2 font-medium text-center">Обяз.</th>
                <th className="px-4 py-2 font-medium">Применимость</th>
                <th className="px-4 py-2 font-medium text-center">Активно</th>
                <th className="px-4 py-2 font-medium text-center">В заказе</th>
                <th className="px-4 py-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {g.fields.map((f) => (
                <tr key={f.id}
                  className={clsx("hover:bg-gray-50 transition cursor-pointer", !f.is_active && "opacity-40")}
                  onClick={() => setEditField(f)}>
                  <td className="px-4 py-2 text-gray-400 text-xs">{f.sort_order}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{f.code}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{f.label}</td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {FIELD_TYPE_LABELS[f.field_type]}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={clsx(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      f.layer === "core" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700",
                    )}>
                      {f.layer === "core" ? "Ядро" : "Вариант"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {f.is_required && <span className="text-staleks-error text-xs font-bold">*</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {f.door_type_applicability.map((t) => (
                        <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {DOOR_TYPE_LABELS[t as DoorType] || t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {f.is_active ? <Eye className="mx-auto h-4 w-4 text-green-500" /> : <EyeOff className="mx-auto h-4 w-4 text-gray-300" />}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {f.is_display
                      ? <Eye className="mx-auto h-4 w-4 text-staleks-lime" />
                      : <EyeOff className="mx-auto h-4 w-4 text-gray-200" />}
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={(e) => { e.stopPropagation(); setEditField(f); }} className="rounded p-1 text-gray-400 hover:text-gray-700">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {grouped.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-400">
          <p className="font-medium">Поля не найдены</p>
        </div>
      )}

      {(editField || showCreate) && (
        <FieldEditorModal
          field={editField}
          groups={groups}
          onClose={() => { setEditField(null); setShowCreate(false); }}
          onSaved={() => { setEditField(null); setShowCreate(false); onRefresh(); }}
        />
      )}
    </div>
  );
}
