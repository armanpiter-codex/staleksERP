import clsx from "clsx";
import { DOOR_STATUS_COLORS, DOOR_STATUS_LABELS } from "@/types/orders";
import type { OrderDoor } from "@/types/orders";

interface OrderDoorsTableProps {
  doors: OrderDoor[];
}

export function OrderDoorsTable({ doors }: OrderDoorsTableProps) {
  if (doors.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        Двери будут созданы автоматически при запуске позиции в производство.
      </p>
    );
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-100 text-[10px] uppercase text-gray-400">
          <th className="py-1.5 text-left font-medium">ID</th>
          <th className="py-1.5 text-left font-medium">Маркировка</th>
          <th className="py-1.5 text-left font-medium">Этаж</th>
          <th className="py-1.5 text-left font-medium">Подъезд</th>
          <th className="py-1.5 text-left font-medium">Кв.</th>
          <th className="py-1.5 text-left font-medium">Статус</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {doors.map((door) => (
          <tr key={door.id} className="transition-colors">
            <td className="py-1.5 font-mono text-gray-500">{door.internal_number}</td>
            <td className="py-1.5 text-gray-700">{door.marking || <span className="text-gray-300">—</span>}</td>
            <td className="py-1.5 text-gray-500">{door.floor || <span className="text-gray-300">—</span>}</td>
            <td className="py-1.5 text-gray-500">{door.building_block || <span className="text-gray-300">—</span>}</td>
            <td className="py-1.5 text-gray-500">{door.apartment_number || <span className="text-gray-300">—</span>}</td>
            <td className="py-1.5">
              <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium", DOOR_STATUS_COLORS[door.status])}>
                {DOOR_STATUS_LABELS[door.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
