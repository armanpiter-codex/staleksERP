import clsx from "clsx";
import type { OrderItem } from "@/types/orders";

const SEGMENTS = [
  { key: "doors_completed", color: "bg-green-500", label: "Завершено" },
  { key: "doors_shipped", color: "bg-purple-500", label: "Отгружено" },
  { key: "doors_ready", color: "bg-indigo-500", label: "Готово" },
  { key: "doors_in_production", color: "bg-amber-500", label: "В пр-ве" },
  { key: "doors_pending", color: "bg-gray-300", label: "Ожидает" },
] as const;

interface DoorProgressProps {
  item: OrderItem;
}

export function DoorProgress({ item }: DoorProgressProps) {
  const total = item.doors_count || item.quantity;
  if (total === 0) return null;

  const segments = SEGMENTS.map((seg) => ({
    ...seg,
    count: item[seg.key] as number,
  }));

  return (
    <div className="mt-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <div
                key={seg.key}
                className={clsx("transition-all", seg.color)}
                style={{ width: `${(seg.count / total) * 100}%` }}
                title={`${seg.label}: ${seg.count}`}
              />
            ),
        )}
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-gray-400">
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <span key={seg.key} className="flex items-center gap-1">
                <span className={clsx("inline-block h-1.5 w-1.5 rounded-full", seg.color)} />
                {seg.count} {seg.label.toLowerCase()}
              </span>
            ),
        )}
      </div>
    </div>
  );
}
