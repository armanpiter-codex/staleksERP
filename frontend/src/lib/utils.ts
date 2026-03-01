import type { Order } from "@/types/orders";

/**
 * Format a number as Kazakhstani tenge (₸).
 */
export function kzt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const num = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(num)) return "—";
  return (
    new Intl.NumberFormat("ru-KZ", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num) + " ₸"
  );
}

/**
 * Extract error detail from an axios-like error response.
 */
export function apiError(err: unknown): string {
  const e = err as { response?: { data?: { detail?: string; message?: string } } };
  const d = e?.response?.data;
  return d?.detail ?? d?.message ?? "Произошла ошибка";
}

/**
 * Format ISO datetime as dd.mm.yyyy hh:mm.
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format ISO datetime as dd.mm.yyyy.
 */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU");
}

/**
 * Sum of all item quantities in an order.
 */
export function totalDoors(order: Order): number {
  return order.items.reduce((s, i) => s + i.quantity, 0);
}
