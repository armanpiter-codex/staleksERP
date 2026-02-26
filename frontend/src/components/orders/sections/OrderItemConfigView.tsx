"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Save, Undo2, ChevronRight, Check, Loader2, Zap, X } from "lucide-react";
import clsx from "clsx";
import {
  getConfiguration,
  updateConfiguration,
} from "@/lib/configuratorApi";
import {
  getOrder,
  updateItem,
  transitionItemStatus,
  applyMarkings,
} from "@/lib/ordersApi";
import type { ApplyMarkingsPayload } from "@/lib/ordersApi";
import { kzt, apiError } from "@/lib/utils";
import type { Order, OrderItem, OrderItemStatus } from "@/types/orders";
import type {
  ConfiguratorCatalog,
  VisibilityRule,
  DoorType,
  DoorConfiguration,
  ConfigurationValues,
} from "@/types/configurator";
import {
  ITEM_STATUS_LABELS,
  ITEM_STATUS_COLORS,
  ITEM_STATUS_NEXT,
  ITEM_STATUS_NEXT_LABELS,
} from "@/types/orders";
import { DOOR_TYPE_LABELS } from "@/types/configurator";
import DoorConfiguratorForm from "@/components/configurator/DoorConfiguratorForm";
import { OrderDoorsTable } from "./OrderDoorsTable";

// ─── Confirm Production Modal ─────────────────────────────────────────────────

const CONFIRM_PHRASE = "Запустить в производство";

function ConfirmProductionModal({
  itemName,
  onConfirm,
  onCancel,
}: {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const isMatch = input === CONFIRM_PHRASE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onCancel} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
            <Zap className="h-5 w-5 text-orange-500" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Запустить в производство?</h2>
        </div>
        <p className="mb-1 text-sm text-gray-600">
          Позиция <span className="font-medium text-gray-800">{itemName}</span> будет запущена в производство.
        </p>
        <p className="mb-4 text-sm text-red-500">
          Это действие необратимо. После запуска начнётся расход сырья и позиция
          войдёт в производственный план.
        </p>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Введите <span className="font-semibold text-gray-700">«{CONFIRM_PHRASE}»</span> для подтверждения:
        </label>
        <input
          autoFocus
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          className="mb-5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={!isMatch}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              isMatch
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "cursor-not-allowed bg-gray-200 text-gray-400",
            )}
          >
            Запустить в производство
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrderItemConfigViewProps {
  order: Order;
  item: OrderItem;
  catalog: ConfiguratorCatalog;
  rules: VisibilityRule[];
  onOrderUpdated: (order: Order) => void;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderItemConfigView({
  order,
  item,
  catalog,
  rules,
  onOrderUpdated,
  onBack,
}: OrderItemConfigViewProps) {
  // ── State ──
  const [config, setConfig] = useState<DoorConfiguration | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [values, setValues] = useState<ConfigurationValues>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Marking state ──
  const [markingType, setMarkingType] = useState<"none" | "auto" | "manual">("none");
  const [markingPrefix, setMarkingPrefix] = useState("DS");
  const [markingStart, setMarkingStart] = useState(1);
  const [markingManual, setMarkingManual] = useState("");
  const [markingApplying, setMarkingApplying] = useState(false);

  const isEditable = ["draft", "confirmed"].includes(item.status);
  const doorType = (item.door_type as DoorType) || "technical";
  const nextItemStatus = ITEM_STATUS_NEXT[item.status];

  // ── Load configuration ──
  useEffect(() => {
    setConfigLoading(true);
    getConfiguration(item.configuration_id)
      .then((c) => {
        setConfig(c);
        const merged: ConfigurationValues = { ...c.values };
        if (item.variant_values) {
          Object.entries(item.variant_values).forEach(([k, v]) => {
            merged[k] = v;
          });
        }
        setValues(merged);
      })
      .catch(console.error)
      .finally(() => setConfigLoading(false));
  }, [item.configuration_id, item.variant_values]);

  // ── Refresh order after mutations ──
  const refreshOrder = useCallback(async () => {
    const fresh = await getOrder(order.id);
    onOrderUpdated(fresh);
    return fresh;
  }, [order.id, onOrderUpdated]);

  // ── Detect current model ──
  const currentModelCode = useMemo(() => {
    const modelField = catalog.field_definitions.find((f) => f.code === "model");
    if (modelField && values.model) return String(values.model);
    return undefined;
  }, [catalog.field_definitions, values]);

  // ── Handlers ──
  const handleFieldChange = (code: string, value: string | number | boolean | null) => {
    setValues((prev) => ({ ...prev, [code]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateConfiguration(config.id, { values });
      const variantFields = catalog.field_definitions
        .filter((f) => f.layer === "variant")
        .map((f) => f.code);
      const variantVals: ConfigurationValues = {};
      for (const code of variantFields) {
        if (values[code] !== undefined && values[code] !== null) {
          variantVals[code] = values[code];
        }
      }
      if (Object.keys(variantVals).length > 0) {
        await updateItem(order.id, item.id, { variant_values: variantVals });
      }
      await refreshOrder();
      setDirty(false);
    } catch (err) {
      alert(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleItemStatusAdvance = async (nextStatus: OrderItemStatus) => {
    try {
      await transitionItemStatus(order.id, item.id, nextStatus);
      await refreshOrder();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleApplyMarkings = async () => {
    setMarkingApplying(true);
    try {
      const payload: ApplyMarkingsPayload = {
        marking_type: markingType,
        prefix: markingType === "auto" ? markingPrefix : undefined,
        start_number: markingType === "auto" ? markingStart : undefined,
        markings:
          markingType === "manual"
            ? markingManual.split("\n").map((s) => s.trim()).filter(Boolean)
            : undefined,
      };
      const updatedOrder = await applyMarkings(order.id, item.id, payload);
      onOrderUpdated(updatedOrder);
    } catch (err) {
      alert(apiError(err));
    } finally {
      setMarkingApplying(false);
    }
  };

  // ── Render ──
  return (
    <>
      <div className="space-y-5">
        {/* ── Header: back + status + actions ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            К заказу {order.order_number}
          </button>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span className={clsx("rounded-full px-3 py-1 text-xs font-medium", ITEM_STATUS_COLORS[item.status])}>
              {ITEM_STATUS_LABELS[item.status]}
            </span>

            {/* Undo — only from confirmed */}
            {item.status === "confirmed" && (
              <button
                onClick={() => handleItemStatusAdvance("draft")}
                className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition"
              >
                <Undo2 className="h-3.5 w-3.5" />
                В черновик
              </button>
            )}

            {/* Advance — only in draft/confirmed */}
            {isEditable && nextItemStatus && (
              <button
                onClick={() => {
                  if (item.status === "confirmed") {
                    setConfirmOpen(true);
                  } else {
                    handleItemStatusAdvance(nextItemStatus);
                  }
                }}
                className="flex items-center gap-1 rounded-lg bg-staleks-lime/20 px-3 py-1.5 text-xs font-medium text-staleks-sidebar hover:bg-staleks-lime/40 transition"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                {ITEM_STATUS_NEXT_LABELS[item.status]}
              </button>
            )}

            {/* Save */}
            {isEditable && (
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition",
                  dirty
                    ? "bg-staleks-lime text-staleks-sidebar hover:bg-staleks-lime-dark"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed",
                )}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            )}
          </div>
        </div>

        {/* ── Item info card ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-xs text-gray-400">Позиция</span>
              <p className="text-lg font-bold text-gray-800">#{item.position_number}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">Конфигурация</span>
              <p className="text-sm font-medium text-gray-700">{item.configuration_name}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">Тип двери</span>
              <p className="text-sm text-gray-700">{DOOR_TYPE_LABELS[doorType] || doorType}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">Количество</span>
              <p className="text-sm font-medium text-gray-700">{item.quantity} шт.</p>
            </div>
            {item.price_per_unit && (
              <div>
                <span className="text-xs text-gray-400">Цена за шт.</span>
                <p className="text-sm font-medium text-green-600">{kzt(item.price_per_unit)}</p>
              </div>
            )}
            {item.total_price && (
              <div>
                <span className="text-xs text-gray-400">Итого</span>
                <p className="text-sm font-bold text-gray-800">{kzt(item.total_price)}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Configurator Form ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Конфигурация двери</h3>
          {configLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-staleks-lime border-t-transparent" />
            </div>
          ) : (
            <DoorConfiguratorForm
              fields={catalog.field_definitions}
              groups={catalog.groups}
              rules={rules}
              doorType={doorType}
              modelCode={currentModelCode}
              values={values}
              onChange={handleFieldChange}
              readOnly={!isEditable}
            />
          )}
        </div>

        {/* ── Marking Section (shown only when doors exist) ── */}
        {item.doors_count > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Маркировка дверей</h3>
              <button
                onClick={handleApplyMarkings}
                disabled={markingApplying}
                className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-3 py-1.5 text-xs font-semibold text-staleks-sidebar hover:bg-staleks-lime-dark disabled:opacity-50 transition"
              >
                {markingApplying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Применить
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={markingType === "none"} onChange={() => setMarkingType("none")} className="accent-staleks-lime" />
                <span className="text-sm text-gray-700">Без маркировки</span>
              </label>

              <div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={markingType === "auto"} onChange={() => setMarkingType("auto")} className="accent-staleks-lime" />
                  <span className="text-sm text-gray-700">Авто (префикс + нумерация)</span>
                </label>
                {markingType === "auto" && (
                  <div className="ml-6 mt-2 flex flex-wrap items-end gap-4">
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-500">Префикс</label>
                      <input
                        type="text"
                        value={markingPrefix}
                        onChange={(e) => setMarkingPrefix(e.target.value)}
                        placeholder="DS"
                        maxLength={20}
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-staleks-lime"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-500">Начало с</label>
                      <input
                        type="number"
                        min={1}
                        value={markingStart}
                        onChange={(e) => setMarkingStart(Math.max(1, Number(e.target.value)))}
                        className="w-16 rounded border border-gray-200 px-2 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-staleks-lime"
                      />
                    </div>
                    <div className="text-xs text-gray-400">
                      Превью:{" "}
                      <span className="font-medium text-gray-600">
                        {Array.from({ length: Math.min(5, item.doors_count) }, (_, i) =>
                          `${markingPrefix}${markingStart + i}`,
                        ).join(", ")}
                        {item.doors_count > 5 && "..."}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={markingType === "manual"} onChange={() => setMarkingType("manual")} className="accent-staleks-lime" />
                  <span className="text-sm text-gray-700">Вручную</span>
                </label>
                {markingType === "manual" && (
                  <div className="ml-6 mt-2">
                    <p className="mb-1.5 text-xs text-gray-500">
                      По одному на строку ({item.doors_count} дверей):
                    </p>
                    <textarea
                      value={markingManual}
                      onChange={(e) => setMarkingManual(e.target.value)}
                      placeholder={"DS5\nDS6\nDS7\n..."}
                      rows={Math.min(8, item.doors_count)}
                      className="w-full rounded border border-gray-200 px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-staleks-lime"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Doors Section ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Двери
            {item.doors_count > 0 && (
              <span className="ml-2 font-normal text-gray-400">({item.doors_count})</span>
            )}
          </h3>
          <OrderDoorsTable doors={item.doors} />
        </div>

        {/* ── Notes ── */}
        {item.notes && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Примечания</h3>
            <p className="text-sm text-gray-600">{item.notes}</p>
          </div>
        )}
      </div>

      {/* Confirm Production Modal */}
      {confirmOpen && nextItemStatus && (
        <ConfirmProductionModal
          itemName={item.configuration_name ?? `Позиция #${item.position_number}`}
          onConfirm={() => {
            setConfirmOpen(false);
            handleItemStatusAdvance(nextItemStatus);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
