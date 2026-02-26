import { Calendar } from "lucide-react";
import { fmtDate, fmtDateShort } from "@/lib/utils";
import type { Order } from "@/types/orders";

interface OrderHistorySectionProps {
  order: Order;
}

export function OrderHistorySection({ order }: OrderHistorySectionProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        <Calendar className="mr-1 inline h-4 w-4" />История
      </h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Создан</span>
          <span className="text-gray-700">{fmtDate(order.created_at)}</span>
        </div>
        {order.confirmed_at && (
          <div className="flex justify-between">
            <span className="text-blue-400">Активирован</span>
            <span className="text-gray-700">{fmtDate(order.confirmed_at)}</span>
          </div>
        )}
        {order.production_started_at && (
          <div className="flex justify-between">
            <span className="text-amber-400">Производство</span>
            <span className="text-gray-700">{fmtDate(order.production_started_at)}</span>
          </div>
        )}
        {order.completed_at && (
          <div className="flex justify-between">
            <span className="text-green-500">Завершён</span>
            <span className="text-gray-700">{fmtDate(order.completed_at)}</span>
          </div>
        )}
        {order.desired_delivery_date && (
          <div className="flex justify-between border-t pt-2">
            <span className="text-gray-400">Желаемая доставка</span>
            <span className="text-gray-700">{fmtDateShort(order.desired_delivery_date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
