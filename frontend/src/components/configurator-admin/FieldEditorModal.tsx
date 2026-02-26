"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { DoorFieldDefinition, FieldType, DoorType, FieldOption } from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import {
  createFieldDefinition,
  updateFieldDefinition,
  type FieldDefinitionCreate,
  type FieldDefinitionUpdate,
} from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";
import { Modal } from "@/components/ui";
import { FIELD_TYPE_LABELS, transliterate } from "./constants";

interface FieldEditorModalProps {
  field: DoorFieldDefinition | null;
  groups: Array<{ code: string; label: string }>;
  onClose: () => void;
  onSaved: () => void;
}

export function FieldEditorModal({ field, groups, onClose, onSaved }: FieldEditorModalProps) {
  const isNew = !field;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorTab, setEditorTab] = useState<"basic" | "options">("basic");

  // Form state
  const [code, setCode] = useState(field?.code || "");
  const [label, setLabel] = useState(field?.label || "");
  const [labelShort, setLabelShort] = useState(field?.label_short || "");
  const [fieldType, setFieldType] = useState<FieldType>(field?.field_type || "text");
  const [groupCode, setGroupCode] = useState(field?.group_code || groups[0]?.code || "");
  const [sortOrder, setSortOrder] = useState(field?.sort_order ?? 100);
  const [unit, setUnit] = useState(field?.unit || "");
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false);
  const [isActive, setIsActive] = useState(field?.is_active ?? true);
  const [layer, setLayer] = useState(field?.layer || "core");
  const [notes, setNotes] = useState(field?.notes || "");
  const [defaultValue, setDefaultValue] = useState(field?.default_value || "");
  const [applicability, setApplicability] = useState<string[]>(field?.door_type_applicability || ["technical", "finish"]);
  const [options, setOptions] = useState<FieldOption[]>(field?.options || []);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isDisplay, setIsDisplay] = useState(field?.is_display ?? true);
  const [displayOrder, setDisplayOrder] = useState<number | "">(field?.display_order ?? "");

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (isNew) setCode(transliterate(val));
  };

  const toggleApplicability = (type: string) => {
    setApplicability((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  // Options management
  const addOption = () => setOptions([...options, { value: "", label: "" }]);
  const updateOption = (idx: number, key: "value" | "label", val: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      if (key === "label" && !next[idx].value) next[idx].value = transliterate(val);
      return next;
    });
  };
  const removeOption = (idx: number) => setOptions((prev) => prev.filter((_, i) => i !== idx));

  const applyBulk = () => {
    const lines = bulkText.split("\n").filter((l) => l.trim());
    const newOptions = lines.map((line) => {
      const parts = line.split("|");
      if (parts.length === 2) return { value: parts[0].trim(), label: parts[1].trim() };
      const lbl = parts[0].trim();
      return { value: transliterate(lbl), label: lbl };
    });
    setOptions([...options, ...newOptions]);
    setBulkText("");
    setBulkMode(false);
  };

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) { setError("Код и название обязательны"); return; }
    setSaving(true);
    setError("");
    try {
      const groupLabel = groups.find((g) => g.code === groupCode)?.label || groupCode;
      if (isNew) {
        const payload: FieldDefinitionCreate = {
          code: code.trim(), label: label.trim(), label_short: labelShort.trim() || null,
          field_type: fieldType, group_code: groupCode, group_label: groupLabel,
          sort_order: sortOrder, is_required: isRequired, door_type_applicability: applicability,
          unit: unit.trim() || null, notes: notes.trim() || null,
          default_value: defaultValue.trim() || null,
          options: ["select", "multiselect"].includes(fieldType) ? options : null,
          is_display: isDisplay,
          display_order: displayOrder !== "" ? displayOrder : null,
        };
        await createFieldDefinition(payload);
      } else {
        const payload: FieldDefinitionUpdate = {
          label: label.trim(), label_short: labelShort.trim() || null,
          group_code: groupCode, group_label: groupLabel,
          sort_order: sortOrder, is_required: isRequired, door_type_applicability: applicability,
          unit: unit.trim() || null, notes: notes.trim() || null,
          default_value: defaultValue.trim() || null, is_active: isActive,
          options: ["select", "multiselect"].includes(fieldType) ? options : null,
          is_display: isDisplay,
          display_order: displayOrder !== "" ? displayOrder : null,
        };
        await updateFieldDefinition(field!.code, payload);
      }
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime";
  const showOptions = ["select", "multiselect"].includes(fieldType);

  return (
    <Modal
      title={isNew ? "Новое поле" : `Редактирование: ${field!.label}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          {error && <p className="mr-auto text-sm text-staleks-error">{error}</p>}
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-5 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 disabled:opacity-50 transition">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Создать" : "Сохранить"}
          </button>
        </>
      }
    >
      {/* Internal tabs */}
      <div className="flex border-b border-gray-100 -mx-6 px-6 -mt-4 mb-4">
        {(["basic", ...(showOptions ? ["options"] : [])] as const).map((t) => (
          <button key={t} onClick={() => setEditorTab(t as "basic" | "options")}
            className={clsx(
              "px-3 py-2 text-sm font-medium transition",
              editorTab === t ? "border-b-2 border-staleks-lime text-staleks-sidebar" : "text-gray-400 hover:text-gray-600",
            )}>
            {t === "basic" ? "Основные" : "Опции"}
          </button>
        ))}
      </div>

      {editorTab === "basic" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Код {isNew && <span className="text-xs text-gray-400">(авто)</span>}
              </label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                disabled={!isNew} className={clsx(inputCls, !isNew && "bg-gray-50 text-gray-500")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Название <span className="text-staleks-error">*</span>
              </label>
              <input type="text" value={label} onChange={(e) => handleLabelChange(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Краткое название</label>
              <input type="text" value={labelShort} onChange={(e) => setLabelShort(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Тип поля</label>
              <select value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)}
                disabled={!isNew} className={clsx(inputCls, !isNew && "bg-gray-50")}>
                {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Секция</label>
              <select value={groupCode} onChange={(e) => setGroupCode(e.target.value)} className={inputCls}>
                {groups.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Порядок сортировки</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Слой</label>
              <select value={layer} onChange={(e) => setLayer(e.target.value as "core" | "variant")} className={inputCls} disabled={!isNew}>
                <option value="core">Ядро (core)</option>
                <option value="variant">Вариант (variant)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Единица измерения</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="мм, шт, кг..." className={inputCls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Значение по умолчанию</label>
            <input type="text" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Применимость (типы дверей)</label>
            <div className="flex gap-3">
              {(["technical", "finish"] as DoorType[]).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={applicability.includes(t)} onChange={() => toggleApplicability(t)}
                    className="rounded border-gray-300 text-staleks-lime focus:ring-staleks-lime" />
                  {DOOR_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          {/* Display in order item row */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Отображение в заказе</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isDisplay} onChange={(e) => setIsDisplay(e.target.checked)}
                  className="rounded border-gray-300 text-staleks-lime focus:ring-staleks-lime" />
                Показывать в строке позиции
              </label>
              <div>
                <label className="mb-0.5 block text-xs text-gray-500">Порядок в строке</label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="авто"
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)}
                className="rounded border-gray-300 text-staleks-lime focus:ring-staleks-lime" />
              Обязательное
            </label>
            {!isNew && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-staleks-lime focus:ring-staleks-lime" />
                Активно
              </label>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Заметки / Placeholder</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </div>
        </div>
      )}

      {editorTab === "options" && showOptions && (
        <div className="space-y-3">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="text" value={opt.value} onChange={(e) => updateOption(idx, "value", e.target.value)}
                placeholder="Код"
                className="w-1/3 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-staleks-lime" />
              <input type="text" value={opt.label} onChange={(e) => updateOption(idx, "label", e.target.value)}
                placeholder="Название"
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime" />
              <button onClick={() => removeOption(idx)} className="rounded p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <button onClick={addOption}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Plus className="h-3 w-3" /> Добавить
            </button>
            <button onClick={() => setBulkMode(!bulkMode)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              Массовый ввод
            </button>
          </div>

          {bulkMode && (
            <div className="space-y-2">
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5}
                placeholder={"Одна опция на строку:\nНазвание\nили\nкод|Название"}
                className={inputCls} />
              <button onClick={applyBulk}
                className="rounded-lg bg-staleks-lime px-3 py-1.5 text-xs font-semibold text-staleks-sidebar hover:brightness-95">
                Применить
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
