"use client";

import type { DoorFieldDefinition } from "@/types/configurator";
import clsx from "clsx";

interface FieldRendererProps {
  field: DoorFieldDefinition;
  value: string | number | boolean | null | undefined;
  onChange: (code: string, value: string | number | boolean | null) => void;
  disabled?: boolean;
}

export default function FieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
}: FieldRendererProps) {
  const baseInputClass = clsx(
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm",
    "focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent",
    "disabled:bg-gray-50 disabled:text-gray-400",
    disabled && "cursor-not-allowed",
  );

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-1">
      <label className={labelClass}>
        {field.label}
        {field.unit && (
          <span className="ml-1 text-xs text-gray-400">({field.unit})</span>
        )}
        {field.is_required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {field.field_type === "select" && (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(field.code, e.target.value || null)}
          disabled={disabled}
          className={baseInputClass}
        >
          {!field.is_required && (
            <option value="">— не выбрано —</option>
          )}
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.field_type === "text" && (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(field.code, e.target.value || null)}
          disabled={disabled}
          placeholder={field.notes ?? undefined}
          className={baseInputClass}
        />
      )}

      {field.field_type === "number" && (
        <input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(field.code, v === "" ? null : Number(v));
          }}
          disabled={disabled}
          className={baseInputClass}
        />
      )}

      {field.field_type === "boolean" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true || value === "true"}
            onChange={(e) => onChange(field.code, e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
          />
          <span className="text-sm text-gray-600">{field.notes ?? "Да"}</span>
        </label>
      )}

      {field.field_type === "multiselect" && (
        <select
          multiple
          value={
            Array.isArray(value)
              ? (value as string[])
              : value
              ? [String(value)]
              : []
          }
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map(
              (o) => o.value,
            );
            onChange(field.code, selected.join(",") || null);
          }}
          disabled={disabled}
          className={clsx(baseInputClass, "h-28")}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.notes && field.field_type !== "boolean" && (
        <p className="text-xs text-gray-400">{field.notes}</p>
      )}
    </div>
  );
}
