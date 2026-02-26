import type { ServiceLine } from "@/types/services";

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ClientType = "b2b" | "b2c";

export type SalesChannel = "corporate" | "dealer" | "retail";

export type OrderStatus =
  | "draft"
  | "confirmed"
  | "contract_signed"
  | "active"
  | "completed"
  | "cancelled";

export type OrderItemStatus =
  | "draft"
  | "confirmed"
  | "in_production"
  | "ready_for_shipment"
  | "shipped"
  | "completed"
  | "cancelled";

export type DoorStatus =
  | "pending"
  | "in_production"
  | "ready_for_shipment"
  | "shipped"
  | "completed";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

// ─── OrderDoor ──────────────────────────────────────────────────────────────

export interface OrderDoor {
  id: string;
  order_item_id: string;
  internal_number: string;
  marking: string | null;
  floor: string | null;
  building_block: string | null;
  apartment_number: string | null;
  location_description: string | null;
  status: DoorStatus;
  priority: boolean;
  qr_code: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrderDoorUpdate {
  marking?: string | null;
  floor?: string | null;
  building_block?: string | null;
  apartment_number?: string | null;
  location_description?: string | null;
  notes?: string | null;
}

export interface GenerateDoorsPayload {
  marking_prefix?: string | null;
  start_number?: number;
  count?: number | null;
  floor?: string | null;
  building_block?: string | null;
  apartment_number?: string | null;
}

export interface BatchDoorStatusPayload {
  door_ids: string[];
  status: DoorStatus;
}

// ─── OrderItem ──────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  order_id: string;
  configuration_id: string;
  position_number: number;
  quantity: number;
  status: OrderItemStatus;
  locked_price: string | null;
  locked_cost: string | null;
  variant_values: Record<string, string | number | boolean | null>;
  variant_price: string;
  variant_cost: string;
  priority: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Computed
  configuration_name: string;
  door_type: string;
  price_per_unit: string | null;
  total_price: string | null;

  // Doors
  doors_count: number;
  doors: OrderDoor[];

  // Door progress
  doors_pending: number;
  doors_in_production: number;
  doors_ready: number;
  doors_shipped: number;
  doors_completed: number;
}

export interface OrderItemCreate {
  configuration_id: string;
  quantity?: number;
  variant_values?: Record<string, string | number | boolean | null>;
  priority?: boolean;
  notes?: string | null;
}

export interface OrderItemUpdate {
  quantity?: number;
  variant_values?: Record<string, string | number | boolean | null>;
  priority?: boolean;
  notes?: string | null;
}

// ─── Order ────────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  order_number: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_type: ClientType;
  client_company: string | null;
  status: OrderStatus;
  total_price: string | null;
  prepayment_amount: string | null;
  discount_percent: string | null;
  payment_status: PaymentStatus;
  credit_days: number | null;
  notes: string | null;
  delivery_address: string | null;
  desired_delivery_date: string | null;
  manager_id: string;
  manager_name: string | null;
  created_at: string;
  updated_at: string;

  // Sprint 1 fields
  measurer_id: string | null;
  measurement_cost: string | null;
  object_name: string | null;
  sales_channel: SalesChannel | null;
  vat_rate: string | null;
  delivery_cost: string | null;
  installation_cost: string | null;
  confirmed_at: string | null;
  production_started_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  source: string | null;

  // Facility (объект строительства)
  facility_id: string | null;
  facility_name: string | null;

  // Sprint 2: items instead of configurations
  items: OrderItem[];
}

export interface OrderCreate {
  client_name: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_type: ClientType;
  client_company?: string | null;
  notes?: string | null;
  delivery_address?: string | null;
  desired_delivery_date?: string | null;
  prepayment_amount?: string | null;
  discount_percent?: string | null;
  credit_days?: number | null;
  items?: OrderItemCreate[];
  configuration_ids?: string[]; // legacy

  // Sprint 1 fields
  measurer_id?: string | null;
  measurement_cost?: string | null;
  object_name?: string | null;
  sales_channel?: SalesChannel | null;
  vat_rate?: string | null;
  delivery_cost?: string | null;
  installation_cost?: string | null;
  source?: string | null;

  // Facility
  facility_id?: string | null;
}

export interface OrderUpdate {
  client_name?: string;
  client_phone?: string | null;
  client_email?: string | null;
  client_company?: string | null;
  prepayment_amount?: string | null;
  discount_percent?: string | null;
  credit_days?: number | null;
  notes?: string | null;
  delivery_address?: string | null;
  desired_delivery_date?: string | null;

  // Sprint 1 fields
  measurer_id?: string | null;
  measurement_cost?: string | null;
  object_name?: string | null;
  sales_channel?: SalesChannel | null;
  vat_rate?: string | null;
  delivery_cost?: string | null;
  installation_cost?: string | null;
  source?: string | null;

  // Facility
  facility_id?: string | null;
}

// ─── Facility ─────────────────────────────────────────────────────────────────

export interface Facility {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

// ─── Order Summary ────────────────────────────────────────────────────────────

export interface ItemSummary {
  item_id: string;
  position_number: number;
  configuration_name: string;
  door_type: string;
  quantity: number;
  price_per_unit: string | null;
  total_price: string | null;
  status: OrderItemStatus;
  doors_pending: number;
  doors_in_production: number;
  doors_ready: number;
  doors_shipped: number;
  doors_completed: number;
}

export interface OrderSummary {
  order_id: string;
  order_number: string;
  client_name: string;
  client_type: ClientType;
  status: OrderStatus;
  items_count: number;
  total_doors: number;

  subtotal: string;
  discount_amount: string;
  // Legacy (backward compat)
  measurement_cost: string;
  delivery_cost: string;
  installation_cost: string;
  // Dynamic services
  services: ServiceLine[];
  services_total: string;

  total_before_vat: string;
  vat_rate: string;
  vat_amount: string;
  total_with_vat: string;

  prepayment_amount: string | null;
  outstanding_amount: string | null;
  items: ItemSummary[];
}

// ─── User Brief (for dropdowns) ──────────────────────────────────────────────

export interface UserBrief {
  id: string;
  full_name: string;
  username: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ─── Labels & Colors ──────────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Черновик",
  confirmed: "Согласован",
  contract_signed: "Договор подписан",
  active: "Активный",
  completed: "Завершён",
  cancelled: "Отменён",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  contract_signed: "bg-violet-100 text-violet-700",
  active: "bg-lime-100 text-staleks-sidebar",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export const ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  draft: "Черновик",
  confirmed: "Согласован",
  in_production: "В производстве",
  ready_for_shipment: "Готово к отгрузке",
  shipped: "Отгружено",
  completed: "Завершено",
  cancelled: "Отменено",
};

export const ITEM_STATUS_COLORS: Record<OrderItemStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_production: "bg-amber-100 text-amber-700",
  ready_for_shipment: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export const DOOR_STATUS_LABELS: Record<DoorStatus, string> = {
  pending: "Ожидает",
  in_production: "В производстве",
  ready_for_shipment: "Готово к отгрузке",
  shipped: "Отгружено",
  completed: "Завершено",
};

export const DOOR_STATUS_COLORS: Record<DoorStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  in_production: "bg-amber-100 text-amber-700",
  ready_for_shipment: "bg-indigo-100 text-indigo-700",
  shipped: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Не оплачен",
  partial: "Частично",
  paid: "Оплачен",
  refunded: "Возврат",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-red-50 text-red-700",
  partial: "bg-yellow-50 text-yellow-700",
  paid: "bg-green-50 text-green-700",
  refunded: "bg-gray-100 text-gray-500",
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  b2b: "B2B (Застройщик)",
  b2c: "B2C (Частный)",
};

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  corporate: "Корпоративный",
  dealer: "Дилерский",
  retail: "Розничный",
};

// Шаги вперёд (active — только авто, нет ручной кнопки)
export const ORDER_STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  draft: "confirmed",
  confirmed: "contract_signed",
};

export const ORDER_STATUS_NEXT_LABELS: Partial<Record<OrderStatus, string>> = {
  draft: "Согласовать",
  confirmed: "Договор подписан",
};

// Шаги назад
export const ORDER_STATUS_PREV: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: "draft",
  contract_signed: "confirmed",
};

export const ORDER_STATUS_PREV_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "В черновик",
  contract_signed: "В согласован",
};

export const ITEM_STATUS_NEXT: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  draft: "confirmed",
  confirmed: "in_production",
  in_production: "ready_for_shipment",
  ready_for_shipment: "shipped",
  shipped: "completed",
};

export const ITEM_STATUS_NEXT_LABELS: Partial<Record<OrderItemStatus, string>> = {
  draft: "Согласовать",
  confirmed: "В производство",
  in_production: "Готово к отгрузке",
  ready_for_shipment: "Отгрузить",
  shipped: "Завершить",
};

// МОП: 3 статуса для менеджера (draft, confirmed, in_production)
export const MOP_ITEM_STATUSES: OrderItemStatus[] = ["draft", "confirmed", "in_production"];

// Обратные переходы (confirmed → draft)
export const ITEM_STATUS_PREV: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  confirmed: "draft",
};
