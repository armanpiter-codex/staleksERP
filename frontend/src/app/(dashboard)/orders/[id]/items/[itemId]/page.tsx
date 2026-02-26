"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { getOrder } from "@/lib/ordersApi";
import { getCatalog, listVisibilityRules } from "@/lib/configuratorApi";
import { apiError } from "@/lib/utils";
import { Spinner, ErrorAlert } from "@/components/ui";
import { OrderItemConfigView } from "@/components/orders/sections/OrderItemConfigView";
import type { Order } from "@/types/orders";
import type { ConfiguratorCatalog, VisibilityRule } from "@/types/configurator";

interface PageProps {
  params: Promise<{ id: string; itemId: string }>;
}

export default function OrderItemPage({ params }: PageProps) {
  const { id: orderId, itemId } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [catalog, setCatalog] = useState<ConfiguratorCatalog | null>(null);
  const [rules, setRules] = useState<VisibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ord, cat, rls] = await Promise.all([
        getOrder(orderId),
        getCatalog(),
        listVisibilityRules(),
      ]);
      setOrder(ord);
      setCatalog(cat);
      setRules(rls);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const handleBack = () => router.push("/orders");

  if (loading) {
    return (
      <div>
        <Header title="Позиция заказа" />
        <div className="p-6"><Spinner size="lg" /></div>
      </div>
    );
  }

  if (error || !order || !catalog) {
    return (
      <div>
        <Header title="Позиция заказа" />
        <div className="p-6">
          <ErrorAlert message={error || "Не удалось загрузить данные"} onClose={() => setError("")} />
        </div>
      </div>
    );
  }

  const item = order.items.find((i) => i.id === itemId);
  if (!item) {
    return (
      <div>
        <Header title="Позиция заказа" />
        <div className="p-6">
          <ErrorAlert message="Позиция не найдена в заказе" onClose={handleBack} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title={`Позиция #${item.position_number} — ${order.order_number}`} />
      <div className="p-6">
        <OrderItemConfigView
          order={order}
          item={item}
          catalog={catalog}
          rules={rules}
          onOrderUpdated={setOrder}
          onBack={handleBack}
        />
      </div>
    </div>
  );
}
