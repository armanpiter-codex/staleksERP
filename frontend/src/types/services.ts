// ─── Service Types (настройка технологом) ────────────────────────────────────

export type BillingMethod = "included" | "separate" | "free";

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  default_price: string;
  billing_method: BillingMethod;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceTypeCreate {
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  default_price?: string;
  billing_method?: BillingMethod;
  is_required?: boolean;
  sort_order?: number;
}

export interface ServiceTypeUpdate {
  name?: string;
  description?: string | null;
  icon?: string | null;
  default_price?: string;
  billing_method?: BillingMethod;
  is_required?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

// ─── Order Services (привязка к заказу) ──────────────────────────────────────

export interface OrderService {
  id: string;
  order_id: string;
  service_type_id: string;
  service_type_code: string;
  service_type_name: string;
  service_type_icon: string | null;
  price: string;
  billing_method: BillingMethod;
  billing_entity_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrderServiceCreate {
  service_type_id: string;
  price?: string;
  billing_method?: BillingMethod;
  billing_entity_name?: string | null;
  notes?: string | null;
}

export interface OrderServiceUpdate {
  price?: string;
  billing_method?: BillingMethod;
  billing_entity_name?: string | null;
  notes?: string | null;
}

// ─── Service line in summary ─────────────────────────────────────────────────

export interface ServiceLine {
  service_type_code: string;
  service_type_name: string;
  icon: string | null;
  price: string;
  billing_method: BillingMethod;
  billing_entity_name: string | null;
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = {
  included: "В цене двери",
  separate: "Отдельно",
  free: "Бесплатно",
};
