"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Plus, Upload } from "lucide-react";
import clsx from "clsx";
import {
  addItem,
  getOrder,
  getOrderSummary,
  removeItem,
  transitionItemStatus,
  transitionStatus,
  updateItem,
  updateOrder,
} from "@/lib/ordersApi";
import { getCatalog } from "@/lib/configuratorApi";
import { totalDoors, apiError } from "@/lib/utils";
import type {
  Order,
  OrderItemStatus,
  OrderSummary,
  OrderUpdate,
} from "@/types/orders";
import type { ConfiguratorCatalog } from "@/types/configurator";
import { ORDER_STATUS_NEXT, ORDER_STATUS_PREV } from "@/types/orders";
import { OrderFinancialSummary } from "./OrderFinancialSummary";
import {
  OrderHeaderSection,
  OrderClientSection,
  OrderServicesSection,
  OrderHistorySection,
  OrderItemRow,
  AddItemModal,
} from "./sections";

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrderEditViewProps {
  order: Order;
  onOrderUpdated: (order: Order) => void;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderEditView({ order, onOrderUpdated, onBack }: OrderEditViewProps) {
  // ── Local state ──
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [catalog, setCatalog] = useState<ConfiguratorCatalog | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [financialOpen, setFinancialOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // ── Data Loading ──
  const refreshOrder = useCallback(async (orderId: string) => {
    const fresh = await getOrder(orderId);
    onOrderUpdated(fresh);
    return fresh;
  }, [onOrderUpdated]);

  useEffect(() => {
    const orderId = order.id;

    setSummaryLoading(true);
    getOrderSummary(orderId)
      .then(setSummary)
      .catch(console.error)
      .finally(() => setSummaryLoading(false));

    getCatalog().then(setCatalog).catch(console.error);
  }, [order.id]);

  // ── Order Status Handlers ──
  const handleAdvanceStatus = async () => {
    // draft/confirmed → next step, или active → completed
    const nextStatus = ORDER_STATUS_NEXT[order.status] ??
      (order.status === "active" ? "completed" : null);
    if (!nextStatus) return;
    setStatusUpdating(true);
    try {
      const updated = await transitionStatus(order.id, nextStatus);
      onOrderUpdated(updated);
      const updatedSummary = await getOrderSummary(updated.id);
      setSummary(updatedSummary);
    } catch (err) {
      alert(apiError(err));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleRevertStatus = async () => {
    const prevStatus = ORDER_STATUS_PREV[order.status];
    if (!prevStatus) return;
    setStatusUpdating(true);
    try {
      const updated = await transitionStatus(order.id, prevStatus);
      onOrderUpdated(updated);
      const updatedSummary = await getOrderSummary(updated.id);
      setSummary(updatedSummary);
    } catch (err) {
      alert(apiError(err));
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm("Отменить заказ? Это действие необратимо.")) return;
    try {
      const updated = await transitionStatus(order.id, "cancelled");
      onOrderUpdated(updated);
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleUpdateField = async (field: string, value: unknown) => {
    setEditSaving(true);
    try {
      const updated = await updateOrder(order.id, { [field]: value } as OrderUpdate);
      onOrderUpdated(updated);
      if (["discount_percent", "vat_rate"].includes(field)) {
        const updatedSummary = await getOrderSummary(updated.id);
        setSummary(updatedSummary);
      }
    } catch (err) {
      alert(apiError(err));
    } finally {
      setEditSaving(false);
    }
  };

  // ── Item Handlers ──
  const handleAddItem = async (configId: string, quantity: number) => {
    const updated = await addItem(order.id, {
      configuration_id: configId,
      quantity: quantity ?? 1,
    });
    onOrderUpdated(updated);
    const updatedSummary = await getOrderSummary(updated.id);
    setSummary(updatedSummary);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("Удалить позицию?")) return;
    try {
      const updated = await removeItem(order.id, itemId);
      onOrderUpdated(updated);
      const updatedSummary = await getOrderSummary(updated.id);
      setSummary(updatedSummary);
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleDuplicateItem = async (itemId: string) => {
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return;
    try {
      const updated = await addItem(order.id, {
        configuration_id: item.configuration_id,
        quantity: item.quantity,
        variant_values: item.variant_values && Object.keys(item.variant_values).length > 0
          ? item.variant_values
          : undefined,
        notes: item.notes || undefined,
      });
      onOrderUpdated(updated);
      const updatedSummary = await getOrderSummary(updated.id);
      setSummary(updatedSummary);
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleUpdateItemQty = async (itemId: string, quantity: number) => {
    try {
      const updated = await updateItem(order.id, itemId, { quantity });
      onOrderUpdated(updated);
      const updatedSummary = await getOrderSummary(updated.id);
      setSummary(updatedSummary);
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleItemStatusAdvance = async (itemId: string, nextStatus: OrderItemStatus) => {
    try {
      const updated = await transitionItemStatus(order.id, itemId, nextStatus);
      onOrderUpdated(updated);
      const updatedSummary = await getOrderSummary(updated.id);
      setSummary(updatedSummary);
    } catch (err) {
      alert(apiError(err));
    }
  };

  // ── Render ──
  return (
    <div>
      <OrderHeaderSection
        order={order}
        editSaving={editSaving}
        statusUpdating={statusUpdating}
        onBack={onBack}
        onAdvanceStatus={handleAdvanceStatus}
        onRevertStatus={handleRevertStatus}
        onCancelOrder={handleCancelOrder}
      />

      <div className="space-y-5">
        {/* ── Client Data ── */}
        <OrderClientSection order={order} />

        {/* ── Items Section ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Позиции заказа
              {order.items.length > 0 && (
                <span className="ml-2 font-normal text-gray-400">
                  ({order.items.length} позиций, {totalDoors(order)} дверей)
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {/* Add item button */}
              {!["completed", "cancelled"].includes(order.status) && (
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-3 py-1.5 text-xs font-semibold text-staleks-sidebar hover:bg-staleks-lime-dark transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить позицию
                </button>
              )}
              {/* Import KP stub */}
              <button
                onClick={() => alert("Импорт из коммерческого предложения будет доступен в следующем обновлении")}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition"
                title="Загрузка из коммерческого предложения (в разработке)"
              >
                <Upload className="h-3.5 w-3.5" />
                Импорт КП
              </button>
            </div>
          </div>

          {order.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
              <p className="text-sm text-gray-400">Нет позиций.</p>
              {!["completed", "cancelled"].includes(order.status) && (
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-staleks-lime px-3 py-1.5 text-xs font-semibold text-staleks-sidebar hover:bg-staleks-lime-dark transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить позицию
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {order.items.map((item) => (
                <OrderItemRow
                  key={item.id}
                  item={item}
                  orderId={order.id}
                  catalog={catalog}
                  onUpdateQty={(qty) => handleUpdateItemQty(item.id, qty)}
                  onRemoveItem={() => handleRemoveItem(item.id)}
                  onDuplicateItem={() => handleDuplicateItem(item.id)}
                  onAdvanceItemStatus={(status) => handleItemStatusAdvance(item.id, status)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Services ── */}
        <OrderServicesSection
          order={order}
          onUpdateField={handleUpdateField}
          onServicesChanged={async () => {
            const updatedSummary = await getOrderSummary(order.id);
            setSummary(updatedSummary);
          }}
        />

        {/* ── Financial Summary (collapsible) ── */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <button
            onClick={() => setFinancialOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition"
          >
            <h3 className="text-sm font-semibold text-gray-700">Финансовая сводка</h3>
            <ChevronDown
              className={clsx(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                financialOpen && "rotate-180",
              )}
            />
          </button>
          {financialOpen && (
            <div className="border-t border-gray-100 px-5 pb-4">
              <OrderFinancialSummary order={order} summary={summary} loading={summaryLoading} />
            </div>
          )}
        </div>

        {/* ── History ── */}
        <OrderHistorySection order={order} />
      </div>

      {/* ── Add Item Modal ── */}
      <AddItemModal
        isOpen={addModalOpen}
        orderStatus={order.status}
        onClose={() => setAddModalOpen(false)}
        onAddItem={handleAddItem}
      />
    </div>
  );
}
