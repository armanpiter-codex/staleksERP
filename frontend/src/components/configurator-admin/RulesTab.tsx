"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Link2 } from "lucide-react";
import clsx from "clsx";
import type { DoorFieldDefinition, VisibilityRule } from "@/types/configurator";
import { deleteVisibilityRule } from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";
import { RuleCreateModal } from "./RuleCreateModal";

interface RulesTabProps {
  rules: VisibilityRule[];
  fields: DoorFieldDefinition[];
  onRefresh: () => void;
}

export function RulesTab({ rules, fields, onRefresh }: RulesTabProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fieldByCode = (code: string) => fields.find((f) => f.code === code);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteVisibilityRule(id);
      onRefresh();
    } catch (err) {
      alert(apiError(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rules.length} правил видимости</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 transition">
          <Plus className="h-4 w-4" />
          Новое правило
        </button>
      </div>

      {rules.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Целевое поле</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Зависит от</th>
                <th className="px-4 py-3 font-medium">Значения</th>
                <th className="px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {fieldByCode(r.field_code)?.label || r.field_code}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      r.rule_type === "show_when" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
                    )}>
                      {r.rule_type === "show_when" ? "Показать" : "Скрыть"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {fieldByCode(r.depends_on_field_code)?.label || r.depends_on_field_code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(r.depends_on_value) ? r.depends_on_value : [r.depends_on_value]).map((v) => (
                        <span key={v} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{v}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                      className="rounded p-1 text-gray-400 hover:text-red-500 disabled:opacity-40">
                      {deleting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-400">
          <Link2 className="mx-auto mb-2 h-8 w-8" />
          <p className="font-medium">Нет правил видимости</p>
        </div>
      )}

      {showCreate && (
        <RuleCreateModal
          fields={fields}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); onRefresh(); }}
        />
      )}
    </div>
  );
}
