"use client";

import { CheckSquare, Square, AlertTriangle } from "lucide-react";
import type { DoorPrintData, RouteStageForPrint } from "@/types/production";

interface DoorPrintCardProps {
  data: DoorPrintData;
  onClose: () => void;
}

// Group route stages by phase for phased display
function groupByPhase(stages: RouteStageForPrint[]): Map<number, RouteStageForPrint[]> {
  const map = new Map<number, RouteStageForPrint[]>();
  for (const s of stages) {
    const ph = s.phase ?? 1;
    if (!map.has(ph)) map.set(ph, []);
    map.get(ph)!.push(s);
  }
  return map;
}

export function DoorPrintCard({ data, onClose }: DoorPrintCardProps) {
  const handlePrint = () => {
    window.print();
  };

  const phaseMap = groupByPhase(data.route_stages);
  const phaseNumbers = Array.from(phaseMap.keys()).sort((a, b) => a - b);
  const isPhased = phaseNumbers.length > 1 ||
    data.route_stages.some((s) => s.workshop_name);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Screen-only toolbar */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between bg-staleks-sidebar px-6 py-3">
        <h2 className="text-white font-semibold">
          Печатная форма: {data.internal_number}
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

      {/* Printable content */}
      <div className="max-w-[210mm] mx-auto p-6 print:p-4 print:max-w-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 print:text-xl">
              STALEKS
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Производственный лист</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-gray-800">
              Заказ: {data.order_number}
            </p>
            <p className="text-gray-600">{data.client_name}</p>
            {data.facility_name && (
              <p className="text-gray-500 text-xs">Объект: {data.facility_name}</p>
            )}
            <p className="text-gray-400 text-xs mt-1">{data.print_date}</p>
          </div>
        </div>

        {/* Door identity row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="rounded border border-gray-300 p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Номер</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {data.internal_number}
            </p>
          </div>
          <div className="rounded border border-gray-300 p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Маркировка</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {data.marking || "—"}
            </p>
          </div>
          <div className="rounded border border-gray-300 p-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Модель</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {data.door_model_label || data.configuration_name || "—"}
            </p>
            {data.door_type && (
              <p className="text-xs text-gray-400">
                {data.door_type === "technical" ? "Техническая" : "С отделкой"}
              </p>
            )}
          </div>
        </div>

        {/* Priority badge */}
        {data.priority && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded px-3 py-2 mb-4 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold">СРОЧНЫЙ ЗАКАЗ</span>
          </div>
        )}

        {/* Location info */}
        {(data.floor || data.building_block || data.apartment_number) && (
          <div className="rounded border border-gray-200 p-3 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Местоположение
            </p>
            <div className="grid grid-cols-4 gap-3 text-sm">
              {data.building_block && (
                <div>
                  <span className="text-gray-500">Подъезд: </span>
                  <span className="font-medium">{data.building_block}</span>
                </div>
              )}
              {data.floor && (
                <div>
                  <span className="text-gray-500">Этаж: </span>
                  <span className="font-medium">{data.floor}</span>
                </div>
              )}
              {data.apartment_number && (
                <div>
                  <span className="text-gray-500">Квартира: </span>
                  <span className="font-medium">{data.apartment_number}</span>
                </div>
              )}
              {data.location_description && (
                <div>
                  <span className="text-gray-500">Описание: </span>
                  <span className="font-medium">{data.location_description}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Configuration fields by group */}
        {data.field_groups.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Характеристики
            </p>
            <div className="space-y-2">
              {data.field_groups.map((group) => (
                <div key={group.group_code} className="rounded border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 uppercase">
                    {group.group_label}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {group.fields.map((field) => (
                        <tr key={field.field_code} className="border-t border-gray-100">
                          <td className="px-3 py-1.5 text-gray-500 w-1/3">
                            {field.field_label}
                          </td>
                          <td className="px-3 py-1.5 font-medium text-gray-900">
                            {field.field_value}
                            {field.unit && (
                              <span className="text-gray-400 ml-1 text-xs">{field.unit}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Variant fields */}
        {data.variant_fields.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Варианты (выбор при заказе)
            </p>
            <div className="rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {data.variant_fields.map((field) => (
                    <tr key={field.field_code} className="border-t border-gray-100 first:border-0">
                      <td className="px-3 py-1.5 text-gray-500 w-1/3">
                        {field.field_label}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-gray-900">
                        {field.field_value}
                        {field.unit && (
                          <span className="text-gray-400 ml-1 text-xs">{field.unit}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        {(data.item_notes || data.door_notes) && (
          <div className="rounded border border-gray-200 p-3 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Примечания
            </p>
            {data.item_notes && (
              <p className="text-sm text-gray-700">{data.item_notes}</p>
            )}
            {data.door_notes && (
              <p className="text-sm text-gray-700">{data.door_notes}</p>
            )}
          </div>
        )}

        {/* Production route checklist */}
        {data.route_stages.length > 0 && (
          <div className="mt-6 border-t-2 border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Маршрут производства
              </p>
              <p className="text-xs text-gray-400">
                Этап {data.route_current_step} из {data.route_total_steps}
              </p>
            </div>

            {isPhased ? (
              /* Phased display with workshop grouping */
              <div className="space-y-3">
                {phaseNumbers.map((ph) => {
                  const phaseStages = phaseMap.get(ph) || [];
                  // Group within phase by workshop
                  const byWorkshop = new Map<string, RouteStageForPrint[]>();
                  for (const s of phaseStages) {
                    const key = s.workshop_name || "__none__";
                    if (!byWorkshop.has(key)) byWorkshop.set(key, []);
                    byWorkshop.get(key)!.push(s);
                  }

                  return (
                    <div key={ph} className="border border-gray-200 rounded overflow-hidden">
                      <div className="bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 border-b border-gray-200">
                        Фаза {ph}
                        {byWorkshop.size > 1 && (
                          <span className="ml-2 text-blue-500 font-normal">параллельно</span>
                        )}
                      </div>
                      <div className={byWorkshop.size > 1 ? "grid grid-cols-2 divide-x divide-gray-100" : ""}>
                        {Array.from(byWorkshop.entries()).map(([wsName, wsStages]) => {
                          const firstStage = wsStages[0];
                          const wsColor = firstStage?.workshop_color;
                          return (
                            <div key={wsName} className="p-2">
                              {wsName !== "__none__" && (
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  {wsColor && (
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: wsColor }}
                                    />
                                  )}
                                  <span className="text-xs font-medium text-gray-600">{wsName}</span>
                                </div>
                              )}
                              <div className="space-y-1">
                                {wsStages.map((stage) => (
                                  <div key={stage.step_order} className="flex items-center gap-1.5 text-xs">
                                    {stage.is_completed ? (
                                      <CheckSquare className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                    ) : stage.is_current ? (
                                      <div className="h-3.5 w-3.5 rounded border-2 border-staleks-lime bg-staleks-lime/20 flex-shrink-0" />
                                    ) : (
                                      <Square className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                    )}
                                    <span
                                      className={
                                        stage.is_current
                                          ? "font-bold text-gray-900"
                                          : stage.is_completed
                                            ? "text-gray-400 line-through"
                                            : "text-gray-600"
                                      }
                                    >
                                      {stage.stage_name}
                                    </span>
                                    {stage.is_optional && (
                                      <span className="text-gray-400">(необязат.)</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Legacy flat display */
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {data.route_stages.map((stage) => (
                  <div
                    key={stage.step_order}
                    className="flex items-center gap-2 text-sm"
                  >
                    {stage.is_completed ? (
                      <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : stage.is_current ? (
                      <div className="h-4 w-4 rounded border-2 border-staleks-lime bg-staleks-lime/20 flex-shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span
                      className={
                        stage.is_current
                          ? "font-bold text-gray-900"
                          : stage.is_completed
                            ? "text-gray-500 line-through"
                            : "text-gray-600"
                      }
                    >
                      {stage.step_order}. {stage.stage_name}
                    </span>
                    {stage.is_optional && (
                      <span className="text-xs text-gray-400">(необязат.)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QR placeholder + footer */}
        <div className="mt-6 flex items-end justify-between border-t border-gray-200 pt-4">
          <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
            <span className="text-[10px] text-gray-400 text-center">QR</span>
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
