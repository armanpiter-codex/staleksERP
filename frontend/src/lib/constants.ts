// All permission codes — mirrors backend PERMISSIONS list
export const PERMISSIONS = {
  // Auth
  MANAGE_USERS: "auth:manage_users",
  MANAGE_ROLES: "auth:manage_roles",
  // Orders
  ORDERS_READ: "orders:read",
  ORDERS_WRITE: "orders:write",
  ORDERS_DELETE: "orders:delete",
  ORDERS_READ_B2B: "orders:read_b2b",
  ORDERS_WRITE_B2B: "orders:write_b2b",
  ORDERS_READ_B2C: "orders:read_b2c",
  ORDERS_WRITE_B2C: "orders:write_b2c",
  // Configurator
  CONFIGURATOR_USE: "configurator:use",
  CONFIGURATOR_MANAGE_PRICES: "configurator:manage_prices",
  // KP
  KP_GENERATE: "kp:generate",
  KP_VIEW_ALL: "kp:view_all",
  // Production
  PRODUCTION_READ: "production:read",
  PRODUCTION_MANAGE: "production:manage",
  PRODUCTION_WORKSHOP_OWN: "production:workshop_own",
  // Tech cards
  TECHCARD_READ: "techcard:read",
  TECHCARD_WRITE: "techcard:write",
  // Timesheet
  TIMESHEET_LOG_SELF: "timesheet:log_self",
  TIMESHEET_VIEW_ALL: "timesheet:view_all",
  // Notifications
  NOTIFICATIONS_RECEIVE: "notifications:receive",
  // Dashboard
  DASHBOARD_OWNER: "dashboard:owner",
  DASHBOARD_FOREMAN: "dashboard:foreman",
  // Feedback
  FEEDBACK_WRITE: "feedback:write",
  FEEDBACK_READ: "feedback:read",
  FEEDBACK_MANAGE: "feedback:manage",
  // Admin
  ADMIN_DIRECTORIES: "admin:directories",
  ADMIN_INTEGRATIONS: "admin:integrations",
  ADMIN_SYSTEM: "admin:system",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role names
export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  B2B_MANAGER: "b2b_manager",
  B2C_MANAGER: "b2c_manager",
  MEASURER: "measurer",
  FOREMAN: "foreman",
  WORKER: "worker",
} as const;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const REFRESH_COOKIE_NAME = "refresh_token";
