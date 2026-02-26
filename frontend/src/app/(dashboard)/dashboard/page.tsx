"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();

  return (
    <div>
      <Header title="Дашборд" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-700">
            Добро пожаловать, {user?.full_name}!
          </h2>
          <p className="text-sm text-staleks-muted mt-1">
            Роли: {user?.roles.map((r) => r.display_name).join(", ")}
          </p>
        </div>

        {hasPermission("dashboard:owner") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard title="Заказов в работе" value="—" color="lime" />
            <StatCard title="Выручка B2B (месяц)" value="—" color="green" />
            <StatCard title="Выручка B2C (месяц)" value="—" color="blue" />
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-staleks-muted">
          <p className="text-4xl mb-3">&#x1F6E0;&#xFE0F;</p>
          <p className="font-medium text-gray-700">Модули в разработке</p>
          <p className="text-sm mt-1">
            Заказы, конфигуратор и производство доступны в меню слева.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: "lime" | "green" | "blue";
}) {
  const colors = {
    lime: "bg-[#C0DF16]/10 border-[#C0DF16]/30 text-gray-700",
    green: "bg-green-50 border-green-200 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-sm font-medium opacity-75">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
