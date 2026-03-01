"use client";

/**
 * Production page — Sprint 18.1.
 *
 * Две секции:
 *   Управление  → К запуску | На производстве | Просроченные
 *   Настройки   → Этапы | Маршруты | Цеха | Запуск и Печать
 */

import { useState } from "react";
import clsx from "clsx";
import { Header } from "@/components/layout/Header";
import { Tabs } from "@/components/ui";
import {
  ProductionQueueView,
  StagesManagement,
  RoutesManagement,
  WorkshopsManagement,
  LaunchView,
  OverdueView,
  LaunchSettingsTab,
} from "@/components/production";

type Section = "management" | "settings";
type ManagementTab = "launch" | "queue" | "overdue";
type SettingsTab = "stages" | "routes" | "workshops" | "launch-settings";

const MANAGEMENT_TABS = [
  { key: "launch", label: "К запуску" },
  { key: "queue", label: "На производстве" },
  { key: "overdue", label: "Просроченные" },
];

const SETTINGS_TABS = [
  { key: "stages", label: "Этапы" },
  { key: "routes", label: "Маршруты" },
  { key: "workshops", label: "Цеха" },
  { key: "launch-settings", label: "Запуск и Печать" },
];

export default function ProductionPage() {
  const [section, setSection] = useState<Section>("management");
  const [mgmtTab, setMgmtTab] = useState<ManagementTab>("launch");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("stages");

  return (
    <div>
      <Header title="Производство" />
      <div className="p-6">
        {/* Section switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSection("management")}
            className={clsx(
              "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
              section === "management"
                ? "bg-staleks-sidebar text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            Управление
          </button>
          <button
            onClick={() => setSection("settings")}
            className={clsx(
              "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
              section === "settings"
                ? "bg-staleks-sidebar text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            Настройки
          </button>
        </div>

        {/* Management section */}
        {section === "management" && (
          <>
            <Tabs
              tabs={MANAGEMENT_TABS}
              activeTab={mgmtTab}
              onChange={(key) => setMgmtTab(key as ManagementTab)}
            />
            {mgmtTab === "launch" && <LaunchView />}
            {mgmtTab === "queue" && <ProductionQueueView />}
            {mgmtTab === "overdue" && <OverdueView />}
          </>
        )}

        {/* Settings section */}
        {section === "settings" && (
          <>
            <Tabs
              tabs={SETTINGS_TABS}
              activeTab={settingsTab}
              onChange={(key) => setSettingsTab(key as SettingsTab)}
            />
            {settingsTab === "stages" && <StagesManagement />}
            {settingsTab === "routes" && <RoutesManagement />}
            {settingsTab === "workshops" && <WorkshopsManagement />}
            {settingsTab === "launch-settings" && <LaunchSettingsTab />}
          </>
        )}
      </div>
    </div>
  );
}
