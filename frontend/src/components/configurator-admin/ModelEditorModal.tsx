"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import type {
  DoorModel,
  DoorModelCreate,
  DoorModelUpdate,
  DoorType,
} from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import { apiError } from "@/lib/utils";
import { Modal } from "@/components/ui";
import { transliterate } from "./constants";

interface ModelEditorModalProps {
  model: DoorModel | null; // null = create mode
  onSave: (data: DoorModelCreate | DoorModelUpdate) => Promise<void>;
  onClose: () => void;
}

export function ModelEditorModal({ model, onSave, onClose }: ModelEditorModalProps) {
  const isNew = !model;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [code, setCode] = useState(model?.code || "");
  const [label, setLabel] = useState(model?.label || "");
  const [labelShort, setLabelShort] = useState(model?.label_short || "");
  const [doorType, setDoorType] = useState<DoorType>(model?.door_type || "technical");
  const [sortOrder, setSortOrder] = useState(model?.sort_order ?? 100);
  const [noExterior, setNoExterior] = useState(model?.no_exterior ?? false);
  const [notes, setNotes] = useState(model?.notes || "");

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (isNew) setCode(transliterate(val));
  };

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) {
      setError("Код и название обязательны");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        const payload: DoorModelCreate = {
          code: code.trim(),
          label: label.trim(),
          label_short: labelShort.trim() || null,
          door_type: doorType,
          sort_order: sortOrder,
          no_exterior: noExterior,
          notes: notes.trim() || null,
        };
        await onSave(payload);
      } else {
        const payload: DoorModelUpdate = {
          label: label.trim(),
          label_short: labelShort.trim() || null,
          door_type: doorType,
          sort_order: sortOrder,
          no_exterior: noExterior,
          notes: notes.trim() || null,
        };
        await onSave(payload);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime";

  return (
    <Modal
      title={isNew ? "Новая модель" : `Редактирование: ${model!.label}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          {error && <p className="mr-auto text-sm text-staleks-error">{error}</p>}
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-5 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 disabled:opacity-50 transition"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Создать" : "Сохранить"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Code + Label */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Код {isNew && <span className="text-xs text-gray-400">(авто)</span>}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!isNew}
              className={clsx(inputCls, !isNew && "bg-gray-50 text-gray-500")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Название <span className="text-staleks-error">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        {/* Short label + Door type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Краткое название
            </label>
            <input
              type="text"
              value={labelShort}
              onChange={(e) => setLabelShort(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Тип двери
            </label>
            <select
              value={doorType}
              onChange={(e) => setDoorType(e.target.value as DoorType)}
              className={inputCls}
            >
              {(Object.entries(DOOR_TYPE_LABELS) as [DoorType, string][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        {/* Sort order */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Порядок сортировки
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={noExterior}
                onChange={(e) => setNoExterior(e.target.checked)}
                className="rounded border-gray-300 text-staleks-lime focus:ring-staleks-lime"
              />
              Без наружной отделки
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Заметки</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>
      </div>
    </Modal>
  );
}
