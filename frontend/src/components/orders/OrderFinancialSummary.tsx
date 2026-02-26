import { kzt } from "@/lib/utils";
import type { Order, OrderSummary } from "@/types/orders";
import { PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from "@/types/orders";
import { Loader2, Ruler, Truck, Wrench, Hammer, HardHat, Package, ClipboardList } from "lucide-react";
import clsx from "clsx";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ruler: Ruler,
  truck: Truck,
  wrench: Wrench,
  hammer: Hammer,
  "hard-hat": HardHat,
  package: Package,
  clipboard: ClipboardList,
};

interface OrderFinancialSummaryProps {
  order: Order;
  summary: OrderSummary | null;
  loading: boolean;
}

export function OrderFinancialSummary({ order, summary, loading }: OrderFinancialSummaryProps) {
  return (
    <div className="pt-2">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-staleks-lime" />
        </div>
      ) : summary ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Дверей всего</span>
            <span className="font-medium">{summary.total_doors} шт.</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Позиции ({summary.items_count})</span>
            <span className="font-medium">{kzt(summary.subtotal)}</span>
          </div>
          {parseFloat(summary.discount_amount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Скидка ({order.discount_percent}%)</span>
              <span>&minus;{kzt(summary.discount_amount)}</span>
            </div>
          )}
          {/* Dynamic service lines */}
          {summary.services && summary.services.length > 0 && summary.services.map((svc) => {
            const IconComp = ICON_MAP[svc.icon || ""] || Wrench;
            const isFree = svc.billing_method === "free";
            const isIncluded = svc.billing_method === "included";
            return (
              <div key={svc.service_type_code} className="flex justify-between text-gray-500">
                <span>
                  <IconComp className="mr-1 inline h-3 w-3" />
                  {svc.service_type_name}
                  {svc.billing_entity_name && (
                    <span className="ml-1 text-xs text-gray-400">({svc.billing_entity_name})</span>
                  )}
                </span>
                <span>
                  {isFree
                    ? "Бесплатно"
                    : isIncluded
                      ? "В цене двери"
                      : kzt(svc.price)}
                </span>
              </div>
            );
          })}
          {/* Legacy fallback: show old fields only if no dynamic services */}
          {(!summary.services || summary.services.length === 0) && (
            <>
              {parseFloat(summary.measurement_cost) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span><Ruler className="mr-1 inline h-3 w-3" />Замер</span>
                  <span>{kzt(summary.measurement_cost)}</span>
                </div>
              )}
              {parseFloat(summary.delivery_cost) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span><Truck className="mr-1 inline h-3 w-3" />Доставка</span>
                  <span>{kzt(summary.delivery_cost)}</span>
                </div>
              )}
              {parseFloat(summary.installation_cost) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span><Wrench className="mr-1 inline h-3 w-3" />Монтаж</span>
                  <span>{kzt(summary.installation_cost)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between border-t pt-2 text-gray-700">
            <span>Итого без НДС</span>
            <span className="font-medium">{kzt(summary.total_before_vat)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>НДС ({summary.vat_rate}%)</span>
            <span>{kzt(summary.vat_amount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2.5 font-semibold">
            <span className="text-gray-800">ИТОГО с НДС</span>
            <span className="text-lg text-staleks-sidebar">{kzt(summary.total_with_vat)}</span>
          </div>
          {summary.prepayment_amount && (
            <>
              <div className="flex justify-between text-gray-500">
                <span>Предоплата</span>
                <span>{kzt(summary.prepayment_amount)}</span>
              </div>
              {summary.outstanding_amount !== null && (
                <div className="flex justify-between font-medium">
                  <span className="text-gray-700">Остаток</span>
                  <span className={parseFloat(summary.outstanding_amount ?? "0") > 0 ? "text-red-600" : "text-green-600"}>
                    {kzt(summary.outstanding_amount)}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="border-t pt-2">
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-medium", PAYMENT_STATUS_COLORS[order.payment_status])}>
              {PAYMENT_STATUS_LABELS[order.payment_status]}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Нет данных</p>
      )}
    </div>
  );
}
