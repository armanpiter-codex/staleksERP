"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { getCatalog, listVisibilityRules } from "@/lib/configuratorApi";
import type { ConfiguratorCatalog, VisibilityRule } from "@/types/configurator";
import { apiError } from "@/lib/utils";
import { Spinner, ErrorAlert, Tabs } from "@/components/ui";
import {
  DoorTypesTab,
  ModelsTab,
  SectionsTab,
  FieldsTab,
  RulesTab,
  PreviewTab,
  ExportImportTab,
  ServicesFinanceTab,
  PermissionsTab,
} from "@/components/configurator-admin";

type AdminTab = "types" | "models" | "sections" | "fields" | "rules" | "preview" | "export" | "services" | "permissions";

export default function ConfiguratorPage() {
  const [catalog, setCatalog] = useState<ConfiguratorCatalog | null>(null);
  const [rules, setRules] = useState<VisibilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("types");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cat, rls] = await Promise.all([getCatalog(), listVisibilityRules()]);
      setCatalog(cat);
      setRules(rls);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div><Header title="Конфигуратор" /><Spinner size="lg" /></div>;
  if (error || !catalog) return (
    <div><Header title="Конфигуратор" />
      <div className="p-6"><ErrorAlert message={error || "Не удалось загрузить каталог"} onClose={() => setError("")} /></div>
    </div>
  );

  const tabs = [
    { key: "types", label: "Типы дверей" },
    { key: "models", label: "Модели" },
    { key: "sections", label: `Секции (${catalog.groups.length})` },
    { key: "fields", label: `Поля (${catalog.field_definitions.length})` },
    { key: "rules", label: `Видимость (${rules.length})` },
    { key: "preview", label: "Превью" },
    { key: "export", label: "Экспорт/Импорт" },
    { key: "services", label: "Услуги и финансы" },
    { key: "permissions", label: "Права" },
  ];

  return (
    <div>
      <Header title="Конфигуратор" />
      <div className="p-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(key) => setActiveTab(key as AdminTab)} />
        {activeTab === "types" && <DoorTypesTab fields={catalog.field_definitions} />}
        {activeTab === "models" && <ModelsTab catalog={catalog} onRefresh={load} />}
        {activeTab === "sections" && <SectionsTab catalog={catalog} onRefresh={load} />}
        {activeTab === "fields" && <FieldsTab fields={catalog.field_definitions} groups={catalog.groups} onRefresh={load} />}
        {activeTab === "rules" && <RulesTab rules={rules} fields={catalog.field_definitions} onRefresh={load} />}
        {activeTab === "preview" && <PreviewTab catalog={catalog} rules={rules} />}
        {activeTab === "export" && <ExportImportTab fields={catalog.field_definitions} rules={rules} groups={catalog.groups} />}
        {activeTab === "services" && <ServicesFinanceTab />}
        {activeTab === "permissions" && <PermissionsTab />}
      </div>
    </div>
  );
}
