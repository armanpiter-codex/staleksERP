import { Building2, MapPin } from "lucide-react";
import type { Order } from "@/types/orders";

interface OrderClientSectionProps {
  order: Order;
}

export function OrderClientSection({ order }: OrderClientSectionProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Данные клиента</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-gray-400">ФИО / Контакт</dt>
          <dd className="text-gray-700">{order.client_name}</dd>
        </div>
        {order.client_company && (
          <div>
            <dt className="text-xs text-gray-400">Компания</dt>
            <dd className="text-gray-700">{order.client_company}</dd>
          </div>
        )}
        {order.client_phone && (
          <div>
            <dt className="text-xs text-gray-400">Телефон</dt>
            <dd className="text-gray-700">{order.client_phone}</dd>
          </div>
        )}
        {order.client_email && (
          <div>
            <dt className="text-xs text-gray-400">Email</dt>
            <dd className="text-gray-700">{order.client_email}</dd>
          </div>
        )}
        {(order.facility_name || order.object_name) && (
          <div>
            <dt className="text-xs text-gray-400"><Building2 className="mr-1 inline h-3 w-3" />Объект</dt>
            <dd className="font-medium text-gray-700">{order.facility_name ?? order.object_name}</dd>
          </div>
        )}
        {order.delivery_address && (
          <div className="col-span-2">
            <dt className="text-xs text-gray-400"><MapPin className="mr-1 inline h-3 w-3" />Адрес доставки</dt>
            <dd className="text-gray-700">{order.delivery_address}</dd>
          </div>
        )}
        {order.notes && (
          <div className="col-span-2">
            <dt className="text-xs text-gray-400">Примечание</dt>
            <dd className="italic text-gray-600">{order.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
