"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2, Zap, Copy, Undo2, ExternalLink, X } from "lucide-react";
import clsx from "clsx";
import { kzt } from "@/lib/utils";
import {
  ITEM_STATUS_COLORS,
  ITEM_STATUS_LABELS,
  ITEM_STATUS_NEXT,
  ITEM_STATUS_NEXT_LABELS,
} from "@/types/orders";
import type { OrderItem, OrderItemStatus } from "@/types/orders";
import type { ConfiguratorCatalog } from "@/types/configurator";

// ─── Variant chips helper ─────────────────────────────────────────────────────

interface Chip {
  code: string;
  label: string;
  valueLabel: string;
}

function getVariantChips(
  variant_values: Record<string, string | number | boolean | null>,
  catalog: ConfiguratorCatalog | null,
): Chip[] {
  if (!catalog) {
    return Object.entries(variant_values)
      .filter(([, v]) => v !== null && v !== "" && v !== undefined && v !== false)
      .map(([code, value]) => ({ code, label: code, valueLabel: String(value) }));
  }
  return catalog.field_definitions
    .filter(
      (f) =>
        f.is_display &&
        f.code in variant_values &&
        variant_values[f.code] !== null &&
        variant_values[f.code] !== "" &&
        variant_values[f.code] !== undefined &&
        variant_values[f.code] !== false,
    )
    .sort((a, b) => (a.display_order ?? a.sort_order) - (b.display_order ?? b.sort_order))
    .map((field) => {
      const value = variant_values[field.code];
      const label = field.label_short ?? field.label;
      let valueLabel = String(value);
      if (field.field_type === "select" && field.options) {
        const opt = field.options.find((o) => o.value === String(value));
        if (opt) valueLabel = opt.label;
      } else if (typeof value === "boolean") {
        valueLabel = "Да";
      } else if (field.unit) {
        valueLabel = `${value} ${field.unit}`;
      }
      return { code: field.code, label, valueLabel };
    });
}

// ─── Confirm Production Modal ─────────────────────────────────────────────────

const CONFIRM_PHRASE = "Запустить в производство";

interface ConfirmProductionModalProps {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmProductionModal({ itemName, onConfirm, onCancel }: ConfirmProductionModalProps) {
  const [input, setInput] = useState("");
  const isMatch = input === CONFIRM_PHRASE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
            <Zap className="h-5 w-5 text-orange-500" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Запустить в производство?</h2>
        </div>

        {/* Warning */}
        <p className="mb-1 text-sm text-gray-600">
          Позиция{" "}
          <span className="font-medium text-gray-800">{itemName}</span> будет запущена в производство.
        </p>
        <p className="mb-4 text-sm text-red-500">
          Это действие необратимо. После запуска начнётся расход сырья и позиция
          войдёт в производственный план.
        </p>

        {/* Confirmation input */}
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

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
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

interface OrderItemRowProps {
  item: OrderItem;
  orderId: string;
  catalog?: ConfiguratorCatalog | null;
  onUpdateQty: (qty: number) => void;
  onRemoveItem: () => void;
  onDuplicateItem: () => void;
  onAdvanceItemStatus: (status: OrderItemStatus) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderItemRow({
  item,
  orderId,
  catalog = null,
  onUpdateQty,
  onRemoveItem,
  onDuplicateItem,
  onAdvanceItemStatus,
}: OrderItemRowProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nextItemStatus = ITEM_STATUS_NEXT[item.status];
  const isEditable = ["draft", "confirmed"].includes(item.status);
  const chips = item.variant_values ? getVariantChips(item.variant_values, catalog) : [];

  const handleOpenItem = () => {
    router.push(`/orders/${orderId}/items/${item.id}`);
  };

  const handleAdvanceClick = () => {
    if (item.status === "confirmed") {
      // Double-confirmation required for launching to production
      setConfirmOpen(true);
    } else if (nextItemStatus) {
      onAdvanceItemStatus(nextItemStatus);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-gray-100 bg-gray-50">
        {/* Item header — click to open config page */}
        <div
          className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-100/50 transition"
          onClick={handleOpenItem}
        >
          <div className="min-w-0 flex-1">
            {/* First line: status | position number | model name | priority */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status badge — FIRST */}
              <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium", ITEM_STATUS_COLORS[item.status])}>
                {ITEM_STATUS_LABELS[item.status]}
              </span>
              <span className="text-xs font-bold text-gray-400">#{item.position_number}</span>
              <span className="truncate text-sm font-medium text-gray-800">{item.configuration_name}</span>
              {item.priority && (
                <span title="Приоритет">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                </span>
              )}
            </div>

            {/* Variant chips row */}
            {chips.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {chips.map(({ code, label, valueLabel }) => (
                  <span
                    key={code}
                    className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-500 border border-gray-200"
                  >
                    <span className="text-gray-400">{label}:</span> {valueLabel}
                  </span>
                ))}
              </div>
            )}

            {/* Second line: type · qty · price · total · doors */}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span>{item.door_type === "technical" ? "Техническая" : "С отделкой"}</span>
              <span>{item.quantity} шт.</span>
              {item.locked_price ? (
                <span className="font-semibold text-green-600">
                  {kzt(item.locked_price)} /шт.{" "}
                  <span className="text-[10px] font-normal text-green-500">(зафикс.)</span>
                </span>
              ) : item.price_per_unit ? (
                <span className="font-medium text-gray-600">{kzt(item.price_per_unit)} /шт.</span>
              ) : null}
              {parseFloat(item.variant_price || "0") > 0 && (
                <span className="text-[10px] text-purple-500">+{kzt(item.variant_price)} надстр.</span>
              )}
              {item.total_price && (
                <span className="font-semibold text-gray-700">= {kzt(item.total_price)}</span>
              )}
              {item.doors_count > 0 && (
                <span className="text-gray-500">{item.doors_count} дверей</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="ml-3 flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Qty input (editable only in draft/confirmed) */}
            {isEditable && (
              <input
                type="number"
                min={1}
                defaultValue={item.quantity}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs text-center"
                onBlur={(e) => {
                  const v = parseInt(e.target.value);
                  if (v > 0 && v !== item.quantity) onUpdateQty(v);
                }}
              />
            )}

            {/* Revert to draft (only from confirmed) */}
            {item.status === "confirmed" && (
              <button
                onClick={() => onAdvanceItemStatus("draft")}
                className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
                title="Вернуть в черновик"
              >
                <Undo2 className="inline h-3 w-3 mr-0.5" />
                В черновик
              </button>
            )}

            {/* Advance status (only in draft/confirmed) */}
            {isEditable && nextItemStatus && (
              <button
                onClick={handleAdvanceClick}
                className="rounded-lg bg-staleks-lime/20 px-2 py-1 text-[10px] font-medium text-staleks-sidebar hover:bg-staleks-lime/40"
                title={ITEM_STATUS_NEXT_LABELS[item.status]}
              >
                <ChevronRight className="inline h-3 w-3" />
                {ITEM_STATUS_NEXT_LABELS[item.status]}
              </button>
            )}

            {/* Duplicate */}
            <button
              onClick={onDuplicateItem}
              className="rounded-lg p-1 text-gray-300 hover:bg-blue-50 hover:text-blue-500"
              title="Дублировать позицию"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>

            {/* Delete */}
            {isEditable && (
              <button
                onClick={onRemoveItem}
                className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                title="Удалить позицию"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Open config page */}
            <button
              onClick={handleOpenItem}
              className="rounded-lg p-1 text-gray-400 hover:text-staleks-lime"
              title="Открыть конфигурацию"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Production Modal */}
      {confirmOpen && nextItemStatus && (
        <ConfirmProductionModal
          itemName={item.configuration_name ?? `Позиция #${item.position_number}`}
          onConfirm={() => {
            setConfirmOpen(false);
            onAdvanceItemStatus(nextItemStatus);
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
