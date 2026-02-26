import { ArrowRight, ArrowLeft, Building2, ChevronLeft, CheckCircle, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import {
  CLIENT_TYPE_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_NEXT,
  ORDER_STATUS_NEXT_LABELS,
  ORDER_STATUS_PREV,
  ORDER_STATUS_PREV_LABELS,
} from "@/types/orders";
import type { Order } from "@/types/orders";

interface OrderHeaderSectionProps {
  order: Order;
  editSaving: boolean;
  statusUpdating: boolean;
  onBack: () => void;
  onAdvanceStatus: () => void;
  onRevertStatus?: () => void;
  onCancelOrder: () => void;
}

export function OrderHeaderSection({
  order, editSaving, statusUpdating,
  onBack, onAdvanceStatus, onRevertStatus, onCancelOrder,
}: OrderHeaderSectionProps) {
  const nextStatus = ORDER_STATUS_NEXT[order.status];
  const prevStatus = ORDER_STATUS_PREV[order.status];
  const isLocked = ["active", "completed", "cancelled"].includes(order.status);
  const isPreActive = ["draft", "confirmed", "contract_signed"].includes(order.status);

  return (
    <>
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-staleks-muted hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        К списку заказов
      </button>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">{order.order_number}</h2>
            <StatusBadge status={order.status} labels={ORDER_STATUS_LABELS} colors={ORDER_STATUS_COLORS} />
            {editSaving && <Loader2 className="h-4 w-4 animate-spin text-staleks-lime" />}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {order.client_name}
            {order.client_company && <span className="text-gray-400"> &middot; {order.client_company}</span>}
            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {CLIENT_TYPE_LABELS[order.client_type]}
            </span>
            {(order.facility_name || order.object_name) && (
              <span className="ml-1.5 text-gray-400">
                <Building2 className="mr-0.5 inline h-3.5 w-3.5" />{order.facility_name ?? order.object_name}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Назад — только для confirmed и contract_signed */}
          {prevStatus && !isLocked && (
            <button
              onClick={onRevertStatus}
              disabled={statusUpdating}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {ORDER_STATUS_PREV_LABELS[order.status]}
            </button>
          )}

          {/* Вперёд — только draft и confirmed (contract_signed → active только авто) */}
          {nextStatus && !isLocked && (
            <button
              onClick={onAdvanceStatus}
              disabled={statusUpdating}
              className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-4 py-2 text-sm font-semibold text-staleks-sidebar hover:opacity-90 disabled:opacity-50"
            >
              {statusUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {ORDER_STATUS_NEXT_LABELS[order.status]}
            </button>
          )}

          {/* Инфо-блок для contract_signed: объясняем как стать активным */}
          {order.status === "contract_signed" && (
            <span className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-600">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Активируется автоматически при запуске позиции в производство
            </span>
          )}

          {/* Завершить — только для active */}
          {order.status === "active" && (
            <button
              onClick={onAdvanceStatus}
              disabled={statusUpdating}
              className="flex items-center gap-1.5 rounded-lg border border-green-300 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              {statusUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Завершить заказ
            </button>
          )}

          {/* Отменить — только pre-active статусы */}
          {isPreActive && (
            <button
              onClick={onCancelOrder}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              Отменить
            </button>
          )}
        </div>
      </div>
    </>
  );
}
