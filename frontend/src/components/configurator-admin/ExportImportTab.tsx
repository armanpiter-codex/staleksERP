"use client";

import { useState } from "react";
import { Download, Upload, Copy, Check } from "lucide-react";
import type { DoorFieldDefinition, VisibilityRule } from "@/types/configurator";

interface ExportImportTabProps {
  fields: DoorFieldDefinition[];
  rules: VisibilityRule[];
  groups: Array<{ code: string; label: string }>;
}

export function ExportImportTab({ fields, rules, groups }: ExportImportTabProps) {
  const [copied, setCopied] = useState(false);

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    source: "staleks-erp-configurator-admin",
    data: {
      groups,
      fields: fields.map(({ id, ...rest }) => rest),
      rules: rules.map(({ id, ...rest }) => rest),
    },
    stats: {
      groups: groups.length,
      fields: fields.length,
      activeFields: fields.filter((f) => f.is_active).length,
      rules: rules.length,
    },
  };

  const jsonStr = JSON.stringify(exportData, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staleks-configurator-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Экспорт конфигурации</h3>
        <p className="text-sm text-gray-500 mb-4">
          Скачайте текущую конфигурацию как JSON-файл для резервного копирования или переноса.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-gray-800">{exportData.stats.groups}</div>
            <div className="text-xs text-gray-500">Секций</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-gray-800">{exportData.stats.fields}</div>
            <div className="text-xs text-gray-500">Полей</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-gray-800">{exportData.stats.activeFields}</div>
            <div className="text-xs text-gray-500">Активных</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-xl font-bold text-gray-800">{exportData.stats.rules}</div>
            <div className="text-xs text-gray-500">Правил</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleDownload}
            className="flex items-center gap-2 rounded-lg bg-staleks-lime px-4 py-2.5 text-sm font-semibold text-staleks-sidebar hover:brightness-95 transition">
            <Download className="h-4 w-4" />
            Скачать JSON
          </button>
          <button onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Скопировано!" : "Копировать в буфер"}
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Импорт конфигурации</h3>
        <p className="text-sm text-gray-500 mb-4">
          Загрузите JSON-файл для восстановления или обновления конфигурации.
        </p>
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8">
          <div className="text-center">
            <Upload className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400 font-medium">Функция импорта в разработке</p>
            <p className="text-xs text-gray-400 mt-1">Будет доступна в следующем обновлении</p>
          </div>
        </div>
      </div>
    </div>
  );
}
