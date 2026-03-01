"use client";

/**
 * LaunchSettingsTab — Sprint 18.1.
 *
 * 4-й таб настроек в Production. Две секции:
 *   1. Фильтры запуска — CRUD для launch_check_definitions
 *   2. Печатные формы — управление is_print / print_order полей (перенесено из Конфигуратора)
 */

import { useState, useEffect, useCallback } from "react";
import {
  Filter,
  Plus,
  Loader2,
  GripVertical,
  Pencil,
  Save,
  X,
  Printer,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import {
  listLaunchChecks,
  createLaunchCheck,
  updateLaunchCheck,
  reorderLaunchChecks,
} from "@/lib/productionApi";
import { getCatalog, updateFieldDefinition } from "@/lib/configuratorApi";
import type { LaunchCheckDefinition, LaunchCheckDefinitionCreate } from "@/types/production";
import type { DoorFieldDefinition, DoorFieldGroup } from "@/types/configurator";
import { apiError } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════════════════
// Section 1: Launch Filters CRUD
// ═══════════════════════════════════════════════════════════════════════════

function LaunchFiltersCRUD() {
  const [checks, setChecks] = useState<LaunchCheckDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRequired, setEditRequired] = useState(true);

  // New check form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newRequired, setNewRequired] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listLaunchChecks(true);
      setChecks(data);
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
      const payload: LaunchCheckDefinitionCreate = {
        code: newCode.trim().toLowerCase().replace(/\s+/g, "_"),
        name: newName.trim(),
        is_required: newRequired,
        sort_order: (checks.length + 1) * 10,
      };
      await createLaunchCheck(payload);
      setNewCode("");
      setNewName("");
      setNewRequired(true);
      setCreating(false);
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c: LaunchCheckDefinition) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description ?? "");
    setEditRequired(c.is_required);
  };

  const saveEdit = async (c: LaunchCheckDefinition) => {
    setSaving(true);
    setError("");
    try {
      await updateLaunchCheck(c.id, {
        name: editName.trim() || undefined,
        description: editDesc.trim() || null,
        is_required: editRequired,
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: LaunchCheckDefinition) => {
    setError("");
    try {
      await updateLaunchCheck(c.id, { is_active: !c.is_active });
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const moveUp = async (idx: number) => {
    if (idx === 0) return;
    const ids = checks.map((c) => c.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    try {
      await reorderLaunchChecks(ids);
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const moveDown = async (idx: number) => {
    if (idx >= checks.length - 1) return;
    const ids = checks.map((c) => c.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    try {
      await reorderLaunchChecks(ids);
      await load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Filter className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-700">
          Фильтры запуска ({checks.filter((c) => c.is_active).length} активных)
        </h3>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-staleks-sidebar text-white hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          Добавить
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="rounded-lg border border-staleks-lime bg-staleks-lime/5 p-4 mb-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Код (латиница)</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="materials_ready"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-staleks-lime"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Название</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Материалы готовы"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-staleks-lime"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="h-4 w-4 accent-staleks-lime"
              />
              Обязательный
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !newCode.trim() || !newName.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-staleks-lime text-staleks-sidebar font-medium hover:bg-lime-400 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-staleks-muted" />
        </div>
      ) : checks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-staleks-muted text-sm">
          Нет пунктов. Нажмите «Добавить» чтобы создать фильтр.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                <th className="px-3 py-2 w-10 font-medium" />
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium">Код</th>
                <th className="px-3 py-2 font-medium text-center w-24">Обяз.</th>
                <th className="px-3 py-2 font-medium text-center w-24">Активен</th>
                <th className="px-3 py-2 font-medium text-center w-20">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {checks.map((c, idx) => (
                <tr
                  key={c.id}
                  className={clsx(
                    "hover:bg-gray-50 transition",
                    !c.is_active && "opacity-40",
                  )}
                >
                  {/* Reorder */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="text-gray-300 hover:text-gray-500 disabled:invisible text-[10px]"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx >= checks.length - 1}
                        className="text-gray-300 hover:text-gray-500 disabled:invisible text-[10px]"
                      >
                        ▼
                      </button>
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-2">
                    {editingId === c.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-staleks-lime rounded focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <div className="font-medium text-gray-800">{c.name}</div>
                    )}
                  </td>

                  {/* Code */}
                  <td className="px-3 py-2 font-mono text-xs text-staleks-muted">
                    {c.code}
                  </td>

                  {/* Required */}
                  <td className="px-3 py-2 text-center">
                    {editingId === c.id ? (
                      <input
                        type="checkbox"
                        checked={editRequired}
                        onChange={(e) => setEditRequired(e.target.checked)}
                        className="h-4 w-4 accent-staleks-lime"
                      />
                    ) : (
                      <span
                        className={clsx(
                          "inline-block w-2 h-2 rounded-full",
                          c.is_required ? "bg-red-400" : "bg-gray-300",
                        )}
                        title={c.is_required ? "Обязательный" : "Необязательный"}
                      />
                    )}
                  </td>

                  {/* Active */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleActive(c)}
                      className={clsx(
                        "text-xs px-2 py-0.5 rounded-full border",
                        c.is_active
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-gray-50 border-gray-200 text-gray-500",
                      )}
                    >
                      {c.is_active ? "Да" : "Нет"}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 text-center">
                    {editingId === c.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => saveEdit(c)}
                          disabled={saving}
                          className="text-staleks-lime hover:text-lime-600"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(c)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
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

// ═══════════════════════════════════════════════════════════════════════════
// Section 2: Print Forms Settings (self-contained)
// ═══════════════════════════════════════════════════════════════════════════

function PrintFormsSettings() {
  const [fields, setFields] = useState<DoorFieldDefinition[]>([]);
  const [groups, setGroups] = useState<DoorFieldGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [orderValue, setOrderValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const catalog = await getCatalog();
      setFields(catalog.field_definitions);
      setGroups(catalog.groups);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const printFields = fields
    .filter((f) => f.is_print)
    .sort((a, b) => (a.print_order ?? 999) - (b.print_order ?? 999));

  const nonPrintFields = fields
    .filter(
      (f) =>
        !f.is_print &&
        (search
          ? f.label.toLowerCase().includes(search.toLowerCase()) ||
            f.code.toLowerCase().includes(search.toLowerCase())
          : true),
    )
    .sort((a, b) => {
      const ga = groups.findIndex((g) => g.code === a.group_code);
      const gb = groups.findIndex((g) => g.code === b.group_code);
      if (ga !== gb) return ga - gb;
      return a.sort_order - b.sort_order;
    });

  const groupLabel = (code: string) => groups.find((g) => g.code === code)?.label ?? code;

  const togglePrint = async (field: DoorFieldDefinition) => {
    setTogglingId(field.id);
    setError("");
    try {
      await updateFieldDefinition(field.code, {
        is_print: !field.is_print,
        print_order: !field.is_print ? (printFields.length + 1) * 10 : null,
      });
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setTogglingId(null);
    }
  };

  const savePrintOrder = async (field: DoorFieldDefinition) => {
    const val = parseInt(orderValue, 10);
    if (isNaN(val) || val < 0) {
      setEditingOrder(null);
      return;
    }
    setTogglingId(field.id);
    setError("");
    try {
      await updateFieldDefinition(field.code, { print_order: val });
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setTogglingId(null);
      setEditingOrder(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-staleks-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Print fields table */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Printer className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-700">
            Поля в печатных формах ({printFields.length})
          </h3>
        </div>

        {printFields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-staleks-muted text-sm">
            Ни одно поле не добавлено в печать. Включите нужные поля ниже.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-gray-100 text-xs text-gray-400">
                <tr>
                  <th className="px-4 py-2 w-8 font-medium">№</th>
                  <th className="px-4 py-2 font-medium">Поле</th>
                  <th className="px-4 py-2 font-medium">Секция</th>
                  <th className="px-4 py-2 font-medium text-center w-24">Порядок</th>
                  <th className="px-4 py-2 w-16 font-medium text-center">Убрать</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {printFields.map((field, idx) => (
                  <tr key={field.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                        <div>
                          <div className="font-medium text-gray-800">{field.label}</div>
                          <div className="font-mono text-xs text-staleks-muted">{field.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-staleks-muted">
                      {groupLabel(field.group_code)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {editingOrder === field.id ? (
                        <input
                          type="number"
                          value={orderValue}
                          onChange={(e) => setOrderValue(e.target.value)}
                          onBlur={() => savePrintOrder(field)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") savePrintOrder(field);
                            if (e.key === "Escape") setEditingOrder(null);
                          }}
                          autoFocus
                          className="w-16 rounded border border-staleks-lime px-1.5 py-0.5 text-center text-sm focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setEditingOrder(field.id);
                            setOrderValue(String(field.print_order ?? ""));
                          }}
                          className="text-gray-600 hover:text-gray-900 hover:underline"
                        >
                          {field.print_order ?? "—"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {togglingId === field.id ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <button
                          onClick={() => togglePrint(field)}
                          title="Убрать из печати"
                          className="text-blue-400 hover:text-gray-400 transition"
                        >
                          <EyeOff className="mx-auto h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available fields */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Доступные поля ({nonPrintFields.length})
          </h3>
          <div className="ml-auto relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
        </div>

        {nonPrintFields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-staleks-muted text-sm">
            {search ? "Поля не найдены" : "Все поля уже добавлены в печать"}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-gray-100 text-xs text-gray-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Поле</th>
                  <th className="px-4 py-2 font-medium">Секция</th>
                  <th className="px-4 py-2 font-medium">Слой</th>
                  <th className="px-4 py-2 font-medium text-center w-16">Добавить</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {nonPrintFields.map((field) => (
                  <tr
                    key={field.id}
                    className={clsx(
                      "hover:bg-gray-50 transition",
                      !field.is_active && "opacity-40",
                    )}
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-800">{field.label}</div>
                      <div className="font-mono text-xs text-staleks-muted">{field.code}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-staleks-muted">
                      {groupLabel(field.group_code)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          field.layer === "core"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {field.layer === "core" ? "Ядро" : "Вариант"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {togglingId === field.id ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <button
                          onClick={() => togglePrint(field)}
                          title="Добавить в печать"
                          className="text-gray-300 hover:text-blue-500 transition"
                        >
                          <Eye className="mx-auto h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Combined Tab
// ═══════════════════════════════════════════════════════════════════════════

export function LaunchSettingsTab() {
  return (
    <div className="mt-6 space-y-10">
      <LaunchFiltersCRUD />
      <hr className="border-gray-200" />
      <PrintFormsSettings />
    </div>
  );
}
