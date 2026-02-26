// --- Role display names ---

export const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  b2b_manager: "Менеджер B2B",
  b2c_manager: "Менеджер B2C",
  measurer: "Замерщик",
  foreman: "Бригадир",
  worker: "Рабочий",
  warehouse_manager: "Менеджер склада",
  warehouse_worker: "Работник склада",
  installation_foreman: "Бригадир монтажа",
};

// --- Role color classes ---

export const ROLE_COLORS: Record<string, string> = {
  owner: "bg-yellow-100 text-yellow-800",
  admin: "bg-red-100 text-red-800",
  b2b_manager: "bg-blue-100 text-blue-800",
  b2c_manager: "bg-indigo-100 text-indigo-800",
  measurer: "bg-teal-100 text-teal-800",
  foreman: "bg-orange-100 text-orange-800",
  worker: "bg-gray-100 text-gray-700",
  warehouse_manager: "bg-purple-100 text-purple-800",
  warehouse_worker: "bg-violet-100 text-violet-800",
  installation_foreman: "bg-emerald-100 text-emerald-800",
};

// --- Filter dropdown options ---

export const FILTER_ROLES = [
  { value: "", label: "Все роли" },
  { value: "owner", label: "Владелец" },
  { value: "admin", label: "Администратор" },
  { value: "b2b_manager", label: "Менеджер B2B" },
  { value: "b2c_manager", label: "Менеджер B2C" },
  { value: "measurer", label: "Замерщик" },
  { value: "foreman", label: "Бригадир" },
  { value: "worker", label: "Рабочий" },
  { value: "warehouse_manager", label: "Менеджер склада" },
  { value: "warehouse_worker", label: "Работник склада" },
  { value: "installation_foreman", label: "Бригадир монтажа" },
] as const;
