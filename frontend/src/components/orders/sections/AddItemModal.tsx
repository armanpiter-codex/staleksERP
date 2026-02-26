"use client";

import { useState, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { listConfigurations } from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";
import type { DoorConfiguration } from "@/types/configurator";

interface AddItemModalProps {
  isOpen: boolean;
  orderStatus: string;
  onClose: () => void;
  onAddItem: (configId: string, quantity: number) => Promise<void>;
}

export function AddItemModal({ isOpen, orderStatus, onClose, onAddItem }: AddItemModalProps) {
  const [templates, setTemplates] = useState<DoorConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doorType, setDoorType] = useState<"technical" | "finish">("technical");
  const [selectedConfig, setSelectedConfig] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    // Reset state on open
    setDoorType("technical");
    setSelectedConfig("");
    setQuantity(1);
    setSaving(false);
    // Load templates
    setLoading(true);
    listConfigurations({ limit: 200 })
      .then((configs) => setTemplates(configs.filter((c) => c.is_template)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen || ["completed", "cancelled"].includes(orderStatus)) return null;

  const filteredModels = templates.filter((t) => t.door_type === doorType);

  const handleSubmit = async () => {
    if (!selectedConfig) return;
    setSaving(true);
    try {
      await onAddItem(selectedConfig, quantity);
      onClose();
    } catch (err) {
      alert(apiError(err));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Добавить позицию</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-staleks-lime" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Door type toggle */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">Тип двери</label>
              <div className="flex gap-2">
                {(["technical", "finish"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setDoorType(type); setSelectedConfig(""); }}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      doorType === type
                        ? "border-staleks-lime bg-staleks-lime text-staleks-sidebar"
                        : "border-gray-200 text-gray-600 hover:border-staleks-lime hover:bg-[#C0DF16]/5"
                    }`}
                  >
                    {type === "technical" ? "Техническая" : "С отделкой"}
                  </button>
                ))}
              </div>
            </div>

            {/* Model select */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Модель</label>
              {filteredModels.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">
                  Нет доступных шаблонов для этого типа
                </p>
              ) : (
                <select
                  value={selectedConfig}
                  onChange={(e) => setSelectedConfig(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
                >
                  <option value="">— выберите модель —</option>
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                Количество (дверей)
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedConfig || saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar transition hover:bg-staleks-lime-dark disabled:opacity-50"
              >
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Plus className="h-4 w-4" />}
                Добавить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
