"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { OrderListView } from "@/components/orders/OrderListView";
import { OrderCreateForm } from "@/components/orders/OrderCreateForm";
import { OrderEditView } from "@/components/orders/OrderEditView";
import type { Order } from "@/types/orders";

// ─── Page State Machine ──────────────────────────────────────────────────────

type PageState =
  | { view: "list" }
  | { view: "create" }
  | { view: "edit"; order: Order };

// ─── Page Component ──────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [pageState, setPageState] = useState<PageState>({ view: "list" });

  return (
    <div>
      <Header title="Заказы" />
      <div className="p-6">
        {pageState.view === "list" && (
          <OrderListView
            onOpenCreate={() => setPageState({ view: "create" })}
            onOpenEdit={(order) => setPageState({ view: "edit", order })}
          />
        )}

        {pageState.view === "create" && (
          <OrderCreateForm
            onCreated={(order) => setPageState({ view: "edit", order })}
            onCancel={() => setPageState({ view: "list" })}
          />
        )}

        {pageState.view === "edit" && (
          <OrderEditView
            key={pageState.order.id}
            order={pageState.order}
            onOrderUpdated={(order) => setPageState({ view: "edit", order })}
            onBack={() => setPageState({ view: "list" })}
          />
        )}
      </div>
    </div>
  );
}
