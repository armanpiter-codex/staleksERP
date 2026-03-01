"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Tabs } from "@/components/ui";
import {
  ProductionQueueView,
  StagesManagement,
  RoutesManagement,
} from "@/components/production";

type ProductionTab = "queue" | "stages" | "routes";

const TABS = [
  { key: "queue", label: "Очередь" },
  { key: "stages", label: "Этапы" },
  { key: "routes", label: "Маршруты" },
];

export default function ProductionPage() {
  const [activeTab, setActiveTab] = useState<ProductionTab>("queue");

  return (
    <div>
      <Header title="Производство" />
      <div className="p-6">
        <Tabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(key) => setActiveTab(key as ProductionTab)}
        />
        {activeTab === "queue" && <ProductionQueueView />}
        {activeTab === "stages" && <StagesManagement />}
        {activeTab === "routes" && <RoutesManagement />}
      </div>
    </div>
  );
}
