"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type {
  DoorFieldDefinition,
  DoorFieldGroup,
  VisibilityRule,
  DoorType,
} from "@/types/configurator";
import { isFieldVisible } from "@/types/configurator";
import FieldRenderer from "@/components/configurator/FieldRenderer";

interface DoorConfiguratorFormProps {
  fields: DoorFieldDefinition[];
  groups: DoorFieldGroup[];
  rules: VisibilityRule[];
  doorType: DoorType;
  modelCode?: string;
  values: Record<string, string | number | boolean | null>;
  onChange: (code: string, value: string | number | boolean | null) => void;
  readOnly?: boolean;
}

export default function DoorConfiguratorForm({
  fields,
  groups,
  rules,
  doorType,
  modelCode,
  values,
  onChange,
  readOnly = false,
}: DoorConfiguratorFormProps) {
  // Filter fields by door type applicability
  const typeFields = useMemo(
    () => fields.filter((f) => f.door_type_applicability.includes(doorType) && f.is_active),
    [fields, doorType],
  );

  // Group fields by group_code and sort groups
  const groupedSections = useMemo(() => {
    const sortedGroups = [...groups]
      .filter((g) => g.door_type_applicability.includes(doorType) && g.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    return sortedGroups
      .map((group) => {
        const groupFields = typeFields
          .filter((f) => f.group_code === group.code)
          .sort((a, b) => a.sort_order - b.sort_order);

        // Filter to only visible fields
        const visibleFields = groupFields.filter((f) =>
          isFieldVisible(f.code, rules, values),
        );

        return {
          group,
          fields: groupFields,
          visibleFields,
        };
      })
      .filter((section) => section.visibleFields.length > 0);
  }, [groups, typeFields, rules, values, doorType]);

  // Track open/closed accordion state; first section starts open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const sortedGroups = [...groups]
      .filter((g) => g.door_type_applicability.includes(doorType) && g.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
    if (sortedGroups.length > 0) {
      initial[sortedGroups[0].code] = true;
    }
    return initial;
  });

  const toggleSection = (code: string) => {
    setOpenSections((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const handleFieldChange = (code: string, value: string | number | boolean | null) => {
    onChange(code, value);
  };

  if (groupedSections.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
        Нет доступных полей для выбранного типа двери
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groupedSections.map((section) => {
        const isOpen = openSections[section.group.code] ?? false;

        return (
          <div
            key={section.group.code}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => toggleSection(section.group.code)}
              className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {section.group.label}
                </span>
                <span className="text-xs text-gray-400">
                  ({section.visibleFields.length})
                </span>
              </div>
              <ChevronDown
                className={clsx(
                  "h-4 w-4 text-gray-400 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
            </button>

            {/* Accordion body */}
            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {section.visibleFields.map((field) => (
                    <div
                      key={field.code}
                      className={
                        field.field_type === "boolean" ? "sm:col-span-1" : ""
                      }
                    >
                      <FieldRenderer
                        field={field}
                        value={values[field.code] ?? null}
                        onChange={(code, val) => handleFieldChange(code, val)}
                        disabled={readOnly}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
