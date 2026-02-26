"use client";

import { useState } from "react";
import type { DoorMarking } from "@/types/configurator";
import { MARKING_STATUS_LABELS } from "@/types/configurator";
import {
  Plus,
  Wand2,
  Upload,
  Trash2,
  ChevronDown,
  QrCode,
} from "lucide-react";
import clsx from "clsx";
import {
  clearMarkings,
  deleteMarking,
  generateMarkings,
} from "@/lib/configuratorApi";
import GenerateMarkingsModal from "./GenerateMarkingsModal";

interface MarkingsTableProps {
  configId: string;
  markings: DoorMarking[];
  onMarkingsChange: (markings: DoorMarking[]) => void;
  readonly?: boolean;
}

export default function MarkingsTable({
  configId,
  markings,
  onMarkingsChange,
  readonly = false,
}: MarkingsTableProps) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const handleDelete = async (markingId: string) => {
    if (!confirm("Удалить маркировку?")) return;
    setDeleting(markingId);
    try {
      await deleteMarking(markingId);
      onMarkingsChange(markings.filter((m) => m.id !== markingId));
    } finally {
      setDeleting(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Удалить все ${markings.length} маркировок?`)) return;
    setClearing(true);
    try {
      await clearMarkings(configId);
      onMarkingsChange([]);
    } finally {
      setClearing(false);
    }
  };

  const handleGenerated = (newMarkings: DoorMarking[]) => {
    onMarkingsChange([...markings, ...newMarkings]);
    setShowGenerateModal(false);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    in_production: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    shipped: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {!readonly && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            <Wand2 className="h-4 w-4" />
            Сгенерировать
          </button>

          {markings.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Удалить все
            </button>
          )}

          <span className="ml-auto text-sm text-gray-400">
            {markings.length} маркировок
          </span>
        </div>
      )}

      {/* Table */}
      {markings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
          <QrCode className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">Маркировки не добавлены</p>
          {!readonly && (
            <p className="mt-1 text-xs text-gray-400">
              Нажмите «Сгенерировать» для автоматического создания
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Маркировка</th>
                <th className="px-3 py-2 text-left">Этаж</th>
                <th className="px-3 py-2 text-left">Описание</th>
                <th className="px-3 py-2 text-left">Статус</th>
                {!readonly && <th className="px-3 py-2 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {markings.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono font-medium text-gray-800">
                    {m.marking}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{m.floor ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {m.location_description ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusColors[m.status] ?? "bg-gray-100 text-gray-600",
                      )}
                    >
                      {MARKING_STATUS_LABELS[m.status]}
                    </span>
                  </td>
                  {!readonly && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deleting === m.id}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showGenerateModal && (
        <GenerateMarkingsModal
          configId={configId}
          existingCount={markings.length}
          onGenerated={handleGenerated}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  );
}
