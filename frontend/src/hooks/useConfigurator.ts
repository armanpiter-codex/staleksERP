/**
 * Хуки для работы с конфигуратором дверей.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCatalog, updateConfiguration } from "@/lib/configuratorApi";
import type {
  ConfiguratorCatalog,
  ConfigurationValues,
  DoorConfiguration,
  DoorFieldDefinition,
  DoorType,
  FieldLayer,
  PriceCalculation,
} from "@/types/configurator";
import {
  filterFieldsByDoorType,
  filterFieldsByLayer,
  isFieldVisible,
} from "@/types/configurator";
import { getPriceCalculation, listConfigurations } from "@/lib/configuratorApi";

// ─── useCatalog ───────────────────────────────────────────────────────────────

export function useCatalog() {
  const [catalog, setCatalog] = useState<ConfiguratorCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail ?? "Ошибка загрузки каталога");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error };
}

// ─── useConfiguratorForm ─────────────────────────────────────────────────────

interface UseConfiguratorFormOptions {
  configuration: DoorConfiguration;
  catalog: ConfiguratorCatalog;
  layerFilter?: FieldLayer;
  onSaved?: (updated: DoorConfiguration) => void;
}

export function useConfiguratorForm({
  configuration,
  catalog,
  layerFilter,
  onSaved,
}: UseConfiguratorFormOptions) {
  const [values, setValues] = useState<ConfigurationValues>(() => {
    // Мерджим дефолты из каталога с существующими значениями
    const defaults: ConfigurationValues = {};
    for (const field of catalog.field_definitions) {
      if (field.default_value !== null) {
        defaults[field.code] = field.default_value;
      }
    }
    return { ...defaults, ...configuration.values };
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Вычисляем видимые поля реактивно (с опциональной фильтрацией по слою)
  const visibleFields = useMemo<DoorFieldDefinition[]>(() => {
    const doorType = configuration.door_type as DoorType;
    let applicable = filterFieldsByDoorType(catalog.field_definitions, doorType);
    if (layerFilter) {
      applicable = filterFieldsByLayer(applicable, layerFilter);
    }
    return applicable.filter((field) =>
      isFieldVisible(field.code, catalog.visibility_rules, values),
    );
  }, [catalog, configuration.door_type, layerFilter, values]);

  // Группировка видимых полей
  const groupedFields = useMemo(() => {
    const groups: Map<string, { code: string; label: string; fields: DoorFieldDefinition[] }> =
      new Map();

    for (const group of catalog.groups) {
      groups.set(group.code, { ...group, fields: [] });
    }

    for (const field of visibleFields) {
      const group = groups.get(field.group_code);
      if (group) {
        group.fields.push(field);
      }
    }

    // Фильтруем пустые группы
    return Array.from(groups.values()).filter((g) => g.fields.length > 0);
  }, [catalog.groups, visibleFields]);

  const handleChange = useCallback(
    (fieldCode: string, value: string | number | boolean | null) => {
      setValues((prev) => ({ ...prev, [fieldCode]: value }));
    },
    [],
  );

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateConfiguration(configuration.id, { values });
      onSaved?.(updated);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setSaveError(e?.response?.data?.detail ?? "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [configuration.id, values, onSaved]);

  return {
    values,
    visibleFields,
    groupedFields,
    handleChange,
    save,
    saving,
    saveError,
  };
}

// ─── usePriceCalculation ──────────────────────────────────────────────────────

export function usePriceCalculation(configId: string | null, trigger: unknown) {
  const [price, setPrice] = useState<PriceCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!configId) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setLoading(true);
      getPriceCalculation(configId)
        .then(setPrice)
        .catch(() => setPrice(null))
        .finally(() => setLoading(false));
    }, 800); // debounce 800ms

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [configId, trigger]);

  return { price, loading };
}

// ─── useTemplates ──────────────────────────────────────────────────────────────

/**
 * Загружает шаблоны конфигураций (is_template=true).
 * Используется для выбора ядра при добавлении позиции в заказ.
 */
export function useTemplates(doorType?: DoorType) {
  const [templates, setTemplates] = useState<DoorConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listConfigurations({
      is_template: true,
      door_type: doorType,
    })
      .then((data) => {
        if (!cancelled) {
          setTemplates(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.detail ?? "Ошибка загрузки шаблонов");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [doorType]);

  return { templates, loading, error };
}
