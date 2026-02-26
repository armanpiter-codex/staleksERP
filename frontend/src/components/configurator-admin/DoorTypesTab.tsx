"use client";

import { Eye, EyeOff } from "lucide-react";
import type { DoorFieldDefinition } from "@/types/configurator";
import { DOOR_TYPE_LABELS } from "@/types/configurator";

interface DoorTypesTabProps {
  fields: DoorFieldDefinition[];
}

interface TypeInfo {
  code: string;
  label: string;
  fieldCount: number;
  activeFieldCount: number;
  enabled: boolean;
}

const ALL_TYPES = [
  { code: "technical", label: "Техническая", description: "Технические и противопожарные двери (Ei-30, Ei-60, Ei-90, Премиум)" },
  { code: "finish", label: "С отделкой", description: "Двери с декоративной отделкой (Галант, Модена, Элит, Венеция, Палермо, Винорит)" },
  { code: "complex", label: "Сложная", description: "Сложные конструкции (в разработке)" },
];

export function DoorTypesTab({ fields }: DoorTypesTabProps) {
  const types: TypeInfo[] = ALL_TYPES.map((t) => {
    const typeFields = fields.filter((f) => f.door_type_applicability.includes(t.code));
    return {
      code: t.code,
      label: t.label,
      fieldCount: typeFields.length,
      activeFieldCount: typeFields.filter((f) => f.is_active).length,
      enabled: typeFields.length > 0 || t.code !== "complex",
    };
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Глобальные типы дверей. Каждый тип определяет набор доступных моделей, секций и полей.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => {
          const info = ALL_TYPES.find((at) => at.code === t.code)!;
          return (
            <div key={t.code} className={`rounded-xl border bg-white p-5 transition ${t.enabled ? "border-gray-200" : "border-dashed border-gray-200 opacity-50"}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">{t.label}</h3>
                {t.enabled
                  ? <Eye className="h-5 w-5 text-green-500" />
                  : <EyeOff className="h-5 w-5 text-gray-300" />}
              </div>
              <p className="text-sm text-gray-500 mb-4">{info.description}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">{t.activeFieldCount}</span>
                  <span className="text-gray-400">активных полей</span>
                </div>
                {t.fieldCount > t.activeFieldCount && (
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <span>+{t.fieldCount - t.activeFieldCount} скрытых</span>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {t.enabled ? "Активен" : "В разработке"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-700">
        Типы дверей определены на уровне системы. Для добавления нового типа обратитесь к разработчику.
      </div>
    </div>
  );
}
