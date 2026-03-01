"use client";

/**
 * PrintFormsTab — Sprint 17 (10-й таб Конфигуратора).
 *
 * Показывает поля, участвующие в печатных формах (is_print=true),
 * в порядке print_order. Позволяет:
 * - Включить/выключить is_print для каждого поля (toggle)
 * - Изменить print_order inline
 * - Отсортировать по print_order drag-to-reorder (через ввод)
 */

import { useState } from "react";
import { Printer, GripVertical, Eye, EyeOff, Loader2, Search } from "lucide-react";
import clsx from "clsx";
import type { DoorFieldDefinition } from "@/types/configurator";
import { updateFieldDefinition } from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";

interface PrintFormsTabProps {
  fields: DoorFieldDefinition[];
  groups: Array<{ code: string; label: string }>;
  onRefresh: () => void;
}

export function PrintFormsTab({ fields, groups, onRefresh }: PrintFormsTabProps) {
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [orderValue, setOrderValue] = useState("");
  const [error, setError] = useState("");

  // Поля с is_print=true, сортируем по print_order
  const printFields = fields
    .filter((f) => f.is_print)
    .sort((a, b) => (a.print_order ?? 999) - (b.print_order ?? 999));

  // Поля с is_print=false (не в печати), сортируем по group+sort_order
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
        // assign next order if turning on
        print_order: !field.is_print
          ? (printFields.length + 1) * 10
          : null,
      });
      onRefresh();
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
      onRefresh();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setTogglingId(null);
      setEditingOrder(null);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ─── Поля в печати ─── */}
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

      {/* ─── Доступные поля (не в печати) ─── */}
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
