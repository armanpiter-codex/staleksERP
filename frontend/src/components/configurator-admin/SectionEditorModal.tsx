"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import type {
  DoorFieldGroup,
  DoorFieldGroupCreate,
  DoorFieldGroupUpdate,
  DoorType,
} from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import { apiError } from "@/lib/utils";
import { Modal } from "@/components/ui";
import { transliterate } from "./constants";

interface SectionEditorModalProps {
  section: DoorFieldGroup | null; // null = create mode
  onSave: (data: DoorFieldGroupCreate | DoorFieldGroupUpdate) => Promise<void>;
  onClose: () => void;
}

export function SectionEditorModal({ section, onSave, onClose }: SectionEditorModalProps) {
  const isNew = !section;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [code, setCode] = useState(section?.code || "");
  const [label, setLabel] = useState(section?.label || "");
  const [sortOrder, setSortOrder] = useState(section?.sort_order ?? 100);
  const [applicability, setApplicability] = useState<string[]>(
    section?.door_type_applicability || ["technical", "finish"],
  );
  const [notes, setNotes] = useState(section?.notes || "");

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (isNew) setCode(transliterate(val));
  };

  const toggleApplicability = (type: string) => {
    setApplicability((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSave = async () => {
    if (!code.trim() || !label.trim()) {
      setError("Код и название обязательны");
      return;
    }
    if (applicability.length === 0) {
      setError("Выберите хотя бы один тип двери");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        const payload: DoorFieldGroupCreate = {
          code: code.trim(),
          label: label.trim(),
          sort_order: sortOrder,
          door_type_applicability: applicability,
          notes: notes.trim() || null,
        };
        await onSave(payload);
      } else {
        const payload: DoorFieldGroupUpdate = {
          label: label.trim(),
          sort_order: sortOrder,
          door_type_applicability: applicability,
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
      title={isNew ? "Новая секция" : `Редактирование: ${section!.label}`}
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
        </div>

        {/* Door type applicability */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Применимость (типы дверей) <span className="text-staleks-error">*</span>
          </label>
          <div className="flex gap-4">
            {(["technical", "finish"] as DoorType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={applicability.includes(t)}
                  onChange={() => toggleApplicability(t)}
                  className="rounded border-gray-300 text-staleks-lime focus:ring-staleks-lime"
                />
                {DOOR_TYPE_LABELS[t]}
              </label>
            ))}
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
