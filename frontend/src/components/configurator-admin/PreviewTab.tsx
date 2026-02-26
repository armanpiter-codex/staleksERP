"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import type {
  ConfiguratorCatalog,
  VisibilityRule,
  DoorType,
  ConfigurationValues,
} from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import DoorConfiguratorForm from "@/components/configurator/DoorConfiguratorForm";

interface PreviewTabProps {
  catalog: ConfiguratorCatalog;
  rules: VisibilityRule[];
}

export function PreviewTab({ catalog, rules }: PreviewTabProps) {
  const [doorType, setDoorType] = useState<DoorType>("technical");
  const [modelCode, setModelCode] = useState<string>("");
  const [values, setValues] = useState<ConfigurationValues>({});

  // Filter models by selected door type
  const typeModels = useMemo(
    () =>
      catalog.models
        .filter((m) => m.door_type === doorType && m.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [catalog.models, doorType],
  );

  const handleTypeChange = (type: DoorType) => {
    setDoorType(type);
    setModelCode("");
    setValues({});
  };

  const handleFieldChange = (code: string, value: string | number | boolean | null) => {
    setValues((prev) => ({ ...prev, [code]: value }));
  };

  return (
    <div className="space-y-5">
      {/* Type + Model selectors side by side */}
      <div className="flex flex-wrap items-end gap-6">
        {/* Door type selector */}
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700">
            Тип двери
          </span>
          <div className="flex gap-2">
            {(["technical", "finish"] as DoorType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={clsx(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition",
                  doorType === t
                    ? "border-staleks-lime bg-staleks-lime/10 text-staleks-sidebar"
                    : "border-gray-300 text-gray-500 hover:border-gray-400",
                )}
              >
                {DOOR_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Model selector */}
        <div className="min-w-[240px]">
          <span className="mb-2 block text-sm font-medium text-gray-700">
            Модель
          </span>
          <select
            value={modelCode}
            onChange={(e) => {
              setModelCode(e.target.value);
              setValues({});
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          >
            <option value="">Все модели</option>
            {typeModels.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
                {m.no_exterior ? " (без нар. отделки)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected model info */}
      {modelCode && (
        <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-600">
          Модель: <strong>{typeModels.find((m) => m.code === modelCode)?.label}</strong>
          {typeModels.find((m) => m.code === modelCode)?.no_exterior && (
            <span className="ml-2 text-xs text-amber-600">(без наружной отделки)</span>
          )}
        </div>
      )}

      {/* Door Configurator Form (accordion) */}
      <DoorConfiguratorForm
        fields={catalog.field_definitions}
        groups={catalog.groups}
        rules={rules}
        doorType={doorType}
        modelCode={modelCode || undefined}
        values={values}
        onChange={handleFieldChange}
      />
    </div>
  );
}
