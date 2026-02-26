"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Ruler, Truck, Wrench, Hammer, HardHat, Package, ClipboardList } from "lucide-react";
import type { Order } from "@/types/orders";
import type { ServiceType, OrderService as OrderServiceType, BillingMethod } from "@/types/services";
import { BILLING_METHOD_LABELS } from "@/types/services";
import { listServiceTypes, listOrderServices, addOrderService, updateOrderService, removeOrderService } from "@/lib/servicesApi";
import { apiError } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ruler: Ruler,
  truck: Truck,
  wrench: Wrench,
  hammer: Hammer,
  "hard-hat": HardHat,
  package: Package,
  clipboard: ClipboardList,
};

interface OrderServicesSectionProps {
  order: Order;
  onUpdateField: (field: string, value: unknown) => void;
  onServicesChanged?: () => void;
}

export function OrderServicesSection({ order, onServicesChanged }: OrderServicesSectionProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [orderServices, setOrderServices] = useState<OrderServiceType[]>([]);
  const [loading, setLoading] = useState(true);

  const isEditable = ["draft", "confirmed", "contract_signed"].includes(order.status);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [types, services] = await Promise.all([
        listServiceTypes(),
        listOrderServices(order.id),
      ]);
      setServiceTypes(types);
      setOrderServices(services);
    } catch (err) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async (stId: string) => {
    const st = serviceTypes.find((s) => s.id === stId);
    if (!st) return;
    try {
      const created = await addOrderService(order.id, {
        service_type_id: stId,
        price: st.default_price,
        billing_method: st.billing_method,
      });
      setOrderServices((prev) => [...prev, created]);
      onServicesChanged?.();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleUpdatePrice = async (svcId: string, price: string) => {
    try {
      const updated = await updateOrderService(order.id, svcId, { price: price || "0" });
      setOrderServices((prev) => prev.map((s) => s.id === svcId ? updated : s));
      onServicesChanged?.();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleUpdateBilling = async (svcId: string, billing: BillingMethod) => {
    try {
      const updated = await updateOrderService(order.id, svcId, { billing_method: billing });
      setOrderServices((prev) => prev.map((s) => s.id === svcId ? updated : s));
      onServicesChanged?.();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleRemove = async (svcId: string) => {
    try {
      await removeOrderService(order.id, svcId);
      setOrderServices((prev) => prev.filter((s) => s.id !== svcId));
      onServicesChanged?.();
    } catch (err) {
      alert(apiError(err));
    }
  };

  // Available types = not yet added to order
  const appliedTypeIds = new Set(orderServices.map((s) => s.service_type_id));
  const availableTypes = serviceTypes.filter((st) => !appliedTypeIds.has(st.id));

  if (loading) return null;
  if (orderServices.length === 0 && availableTypes.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Дополнительные услуги</h3>

      {orderServices.length === 0 && !isEditable ? (
        <p className="text-sm text-gray-400">Услуги не добавлены</p>
      ) : (
        <div className="space-y-2">
          {orderServices.map((svc) => {
            const IconComp = ICON_MAP[svc.service_type_icon || ""] || Wrench;
            return (
              <div key={svc.id} className="flex items-center gap-3">
                <IconComp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="w-28 text-sm text-gray-600 flex-shrink-0">{svc.service_type_name}</span>
                {isEditable ? (
                  <>
                    <input
                      type="number" min="0"
                      defaultValue={svc.price}
                      onBlur={(e) => handleUpdatePrice(svc.id, e.target.value)}
                      className="w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-staleks-lime"
                    />
                    <select
                      value={svc.billing_method}
                      onChange={(e) => handleUpdateBilling(svc.id, e.target.value as BillingMethod)}
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                    >
                      {(Object.entries(BILLING_METHOD_LABELS) as [BillingMethod, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemove(svc.id)}
                      className="ml-auto rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">
                      {svc.billing_method === "free"
                        ? "Бесплатно"
                        : `${parseFloat(svc.price).toLocaleString()} KZT`}
                    </span>
                    <span className="text-xs text-gray-400">
                      {BILLING_METHOD_LABELS[svc.billing_method]}
                    </span>
                    {svc.billing_entity_name && (
                      <span className="text-xs text-gray-400">({svc.billing_entity_name})</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add service dropdown */}
      {isEditable && availableTypes.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-gray-400" />
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                handleAdd(e.target.value);
                e.target.value = "";
              }
            }}
            className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500"
          >
            <option value="">Добавить услугу...</option>
            {availableTypes.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
