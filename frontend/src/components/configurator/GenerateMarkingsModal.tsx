"use client";

import { useState } from "react";
import { generateMarkings } from "@/lib/configuratorApi";
import type { DoorMarking } from "@/types/configurator";
import { X, Loader2 } from "lucide-react";

interface Props {
  configId: string;
  existingCount: number;
  onGenerated: (markings: DoorMarking[]) => void;
  onClose: () => void;
}

export default function GenerateMarkingsModal({
  configId,
  existingCount,
  onGenerated,
  onClose,
}: Props) {
  const [prefix, setPrefix] = useState("Д");
  const [startNumber, setStartNumber] = useState(existingCount + 1);
  const [count, setCount] = useState(1);
  const [zeroPad, setZeroPad] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = Array.from({ length: Math.min(count, 5) }, (_, i) => {
    const n = startNumber + i;
    return `${prefix}-${String(n).padStart(zeroPad, "0")}`;
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateMarkings(configId, {
        prefix,
        start_number: startNumber,
        count,
        zero_pad: zeroPad,
      });
      onGenerated(result);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e?.response?.data?.detail ?? "Ошибка генерации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Генерация маркировок</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Префикс
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="напр. Д3"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Начальный №
              </label>
              <input
                type="number"
                min={1}
                value={startNumber}
                onChange={(e) => setStartNumber(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Количество
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Нулей в номере
            </label>
            <select
              value={zeroPad}
              onChange={(e) => setZeroPad(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value={2}>2 (01, 02...)</option>
              <option value={3}>3 (001, 002...)</option>
              <option value={4}>4 (0001, 0002...)</option>
            </select>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="mb-1 text-xs font-medium text-gray-500">
              Предпросмотр:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preview.map((p) => (
                <span
                  key={p}
                  className="rounded-md bg-orange-100 px-2 py-0.5 font-mono text-xs text-orange-700"
                >
                  {p}
                </span>
              ))}
              {count > 5 && (
                <span className="text-xs text-gray-400">
                  + ещё {count - 5}...
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !prefix || count < 1}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать {count} шт.
          </button>
        </div>
      </div>
    </div>
  );
}
