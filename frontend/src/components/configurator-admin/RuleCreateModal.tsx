"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { DoorFieldDefinition } from "@/types/configurator";
import { createVisibilityRule, type VisibilityRuleCreate } from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";
import { Modal } from "@/components/ui";

interface RuleCreateModalProps {
  fields: DoorFieldDefinition[];
  onClose: () => void;
  onCreated: () => void;
}

export function RuleCreateModal({ fields, onClose, onCreated }: RuleCreateModalProps) {
  const [fieldCode, setFieldCode] = useState("");
  const [dependsOn, setDependsOn] = useState("");
  const [ruleType, setRuleType] = useState<"show_when" | "hide_when">("show_when");
  const [values, setValues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const depField = fields.find((f) => f.code === dependsOn);

  const toggleValue = (v: string) => {
    setValues((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  const handleSave = async () => {
    if (!fieldCode || !dependsOn || values.length === 0) { setError("Заполните все поля"); return; }
    setSaving(true);
    setError("");
    try {
      const payload: VisibilityRuleCreate = {
        field_code: fieldCode,
        depends_on_field_code: dependsOn,
        depends_on_value: values.length === 1 ? values[0] : values,
        rule_type: ruleType,
      };
      await createVisibilityRule(payload);
      onCreated();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime";

  return (
    <Modal
      title="Новое правило видимости"
      onClose={onClose}
      size="sm"
      footer={
        <>
          {error && <p className="mr-auto text-sm text-staleks-error">{error}</p>}
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-5 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Целевое поле (которое показываем/скрываем)</label>
          <select value={fieldCode} onChange={(e) => setFieldCode(e.target.value)} className={inputCls}>
            <option value="">Выберите поле...</option>
            {fields.filter(f => f.is_active).map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Тип правила</label>
          <select value={ruleType} onChange={(e) => setRuleType(e.target.value as "show_when" | "hide_when")} className={inputCls}>
            <option value="show_when">Показать когда</option>
            <option value="hide_when">Скрыть когда</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Зависит от поля</label>
          <select value={dependsOn} onChange={(e) => { setDependsOn(e.target.value); setValues([]); }} className={inputCls}>
            <option value="">Выберите поле...</option>
            {fields.filter(f => f.is_active && f.code !== fieldCode).map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
          </select>
        </div>
        {depField && depField.options && depField.options.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">При значениях</label>
            <div className="flex flex-wrap gap-2">
              {depField.options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={values.includes(opt.value)} onChange={() => toggleValue(opt.value)}
                    className="rounded border-gray-300 text-staleks-lime focus:ring-staleks-lime" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        )}
        {depField && (!depField.options || depField.options.length === 0) && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">При значении (через запятую)</label>
            <input type="text" value={values.join(", ")}
              onChange={(e) => setValues(e.target.value.split(",").map(v => v.trim()).filter(Boolean))}
              className={inputCls} />
          </div>
        )}
      </div>
    </Modal>
  );
}
