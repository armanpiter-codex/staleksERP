"use client";

import { AlertTriangle } from "lucide-react";
import type { StagePrintData } from "@/types/production";

interface StagePrintSummaryProps {
  data: StagePrintData;
  onClose: () => void;
}

export function StagePrintSummary({ data, onClose }: StagePrintSummaryProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Screen-only toolbar */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between bg-staleks-sidebar px-6 py-3">
        <h2 className="text-white font-semibold">
          Сводка: {data.stage_name} ({data.total_doors} шт.)
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="rounded-lg bg-staleks-lime px-5 py-2 text-sm font-semibold text-staleks-sidebar hover:brightness-95 transition"
          >
            Печать
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-500 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
          >
            Закрыть
          </button>
        </div>
      </div>

      {/* Printable content — landscape orientation */}
      <style>{`@media print { @page { size: landscape; margin: 10mm; } }`}</style>
      <div className="max-w-[297mm] mx-auto p-6 print:p-0 print:max-w-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 print:text-xl">
              STALEKS
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Сводка по этапу производства</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-gray-800 text-lg">
              {data.stage_name}
            </p>
            {data.workshop_name && (
              <p className="text-gray-500 text-xs">Цех: {data.workshop_name}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">{data.print_date}</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mb-4">
          <div className="rounded border border-gray-300 px-4 py-2 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Всего дверей</p>
            <p className="text-2xl font-bold text-gray-900">{data.total_doors}</p>
          </div>
          <div className="rounded border border-gray-300 px-4 py-2 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Срочных</p>
            <p className="text-2xl font-bold text-amber-600">
              {data.doors.filter((d) => d.priority).length}
            </p>
          </div>
        </div>

        {/* Doors table */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left px-2 py-2 font-semibold text-gray-700 w-10">#</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700">Номер</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700">Маркировка</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700">Заказ</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-700">Модель</th>
              <th className="text-center px-2 py-2 font-semibold text-gray-700">Размеры</th>
              <th className="text-center px-2 py-2 font-semibold text-gray-700 w-10">!</th>
            </tr>
          </thead>
          <tbody>
            {data.doors.map((door, idx) => (
              <tr
                key={door.internal_number}
                className={
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                }
              >
                <td className="px-2 py-1.5 text-gray-400 border-b border-gray-100">
                  {idx + 1}
                </td>
                <td className="px-2 py-1.5 font-mono font-medium border-b border-gray-100">
                  {door.internal_number}
                </td>
                <td className="px-2 py-1.5 text-gray-600 border-b border-gray-100">
                  {door.marking || "—"}
                </td>
                <td className="px-2 py-1.5 font-mono text-blue-700 border-b border-gray-100">
                  {door.order_number}
                </td>
                <td className="px-2 py-1.5 text-gray-600 border-b border-gray-100">
                  {door.door_model_label || "—"}
                </td>
                <td className="px-2 py-1.5 text-center text-gray-600 border-b border-gray-100">
                  {door.height && door.width
                    ? `${door.height} × ${door.width}`
                    : "—"}
                </td>
                <td className="px-2 py-1.5 text-center border-b border-gray-100">
                  {door.priority && (
                    <AlertTriangle className="h-4 w-4 text-amber-500 inline-block" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-6 flex items-end justify-between border-t border-gray-200 pt-4">
          <div className="text-xs text-gray-400">
            <p>Итого: {data.total_doors} дверей на этапе «{data.stage_name}»{data.workshop_name ? ` (${data.workshop_name})` : ""}</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>Staleks ERP</p>
            <p>{data.print_date}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
