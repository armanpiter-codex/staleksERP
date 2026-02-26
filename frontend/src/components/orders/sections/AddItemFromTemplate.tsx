import { useState } from "react";
import { Plus, X } from "lucide-react";
import { kzt, apiError } from "@/lib/utils";
import type { ConfiguratorCatalog, ConfigurationValues, DoorConfiguration } from "@/types/configurator";
import { filterFieldsByLayer, filterFieldsByDoorType, isFieldVisible } from "@/types/configurator";

interface AddItemFromTemplateProps {
  templates: DoorConfiguration[];
  availableConfigs: DoorConfiguration[];
  catalog: ConfiguratorCatalog | null;
  orderStatus: string;
  onAddItem: (configId: string, quantity: number, variantValues?: ConfigurationValues) => Promise<void>;
}

export function AddItemFromTemplate({
  templates, availableConfigs, catalog, orderStatus, onAddItem,
}: AddItemFromTemplateProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<DoorConfiguration | null>(null);
  const [variantValues, setVariantValues] = useState<ConfigurationValues>({});
  const [addItemQuantity, setAddItemQuantity] = useState(1);

  if (["completed", "cancelled"].includes(orderStatus)) return null;
  const handleSelectTemplate = (tpl: DoorConfiguration) => {
    setSelectedTemplate(tpl);
    if (catalog) {
      const defaults: ConfigurationValues = {};
      const vf = filterFieldsByLayer(catalog.field_definitions, "variant");
      for (const f of vf) {
        if (f.default_value) defaults[f.code] = f.default_value;
      }
      setVariantValues(defaults);
    }
  };

  const handleAddFromTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await onAddItem(selectedTemplate.id, addItemQuantity, variantValues);
      setSelectedTemplate(null);
      setVariantValues({});
      setAddItemQuantity(1);
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleAddConfig = async (configId: string) => {
    try {
      await onAddItem(configId, 1);
    } catch (err) {
      alert(apiError(err));
    }
  };

  const variantFields = selectedTemplate && catalog
    ? filterFieldsByLayer(
        filterFieldsByDoorType(catalog.field_definitions, selectedTemplate.door_type),
        "variant"
      ).filter((f) => isFieldVisible(f.code, catalog.visibility_rules, variantValues))
    : [];

  return (
    <div className="mt-4 border-t pt-4">
      {/* Variant form — shown when template selected */}
      {selectedTemplate && (
        <div className="mb-4 rounded-lg border border-[#C0DF16]/40 bg-[#C0DF16]/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-700">{selectedTemplate.name}</span>
              <span className="ml-2 rounded bg-[#C0DF16]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#212322]">
                Шаблон
              </span>
            </div>
            <button
              onClick={() => { setSelectedTemplate(null); setVariantValues({}); setAddItemQuantity(1); }}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {variantFields.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-medium text-gray-500">
                Параметры надстройки (цвет, отделка, ручки):
              </p>
              <div className="grid grid-cols-2 gap-2">
                {variantFields.map((field) => (
                  <div key={field.code}>
                    <label className="mb-0.5 block text-[10px] text-gray-500">
                      {field.label}
                      {field.is_required && <span className="text-red-400"> *</span>}
                    </label>
                    {field.field_type === "select" && field.options ? (
                      <select
                        value={(variantValues[field.code] as string) ?? field.default_value ?? ""}
                        onChange={(e) => setVariantValues((prev) => ({ ...prev, [field.code]: e.target.value }))}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-staleks-lime"
                      >
                        <option value="">-- выбрать --</option>
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={(variantValues[field.code] as string) ?? ""}
                        onChange={(e) => setVariantValues((prev) => ({ ...prev, [field.code]: e.target.value }))}
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-staleks-lime"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div>
              <label className="mb-0.5 block text-[10px] text-gray-500">Кол-во</label>
              <input
                type="number"
                min={1}
                value={addItemQuantity}
                onChange={(e) => setAddItemQuantity(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded border border-gray-200 px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-staleks-lime"
              />
            </div>
            <button
              onClick={handleAddFromTemplate}
              className="mt-3 flex items-center gap-1 rounded-lg bg-staleks-lime px-3 py-1.5 text-xs font-semibold text-staleks-sidebar hover:bg-staleks-lime-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить позицию
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {templates.length > 0 && !selectedTemplate && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-gray-500">
            Добавить из шаблона (ядро + надстройка):
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-[#C0DF16]/40 px-3 py-2 text-left text-sm transition-colors hover:border-staleks-lime hover:bg-[#C0DF16]/5"
              >
                <span>
                  <span className="font-medium text-gray-700">{tpl.name}</span>
                  <span className="ml-2 rounded bg-[#C0DF16]/20 px-1 py-0.5 text-[10px] font-medium text-[#212322]">
                    Шаблон
                  </span>
                  <span className="ml-1 text-xs text-gray-400">
                    {tpl.door_type === "technical" ? "Техн." : "Отделка"}
                  </span>
                  {tpl.price_estimate && (
                    <span className="ml-2 text-xs text-orange-500">
                      {kzt(tpl.price_estimate)} /ядро
                    </span>
                  )}
                </span>
                <Plus className="h-4 w-4 shrink-0 text-staleks-lime" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Regular configs (backward compat) */}
      {availableConfigs.length > 0 && !selectedTemplate && (
        <div>
          <p className="mb-2 text-xs font-medium text-gray-400">
            Или из обычной конфигурации:
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {availableConfigs.map((cfg) => (
              <button
                key={cfg.id}
                onClick={() => handleAddConfig(cfg.id)}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-gray-200 px-3 py-2 text-left text-sm transition-colors hover:border-staleks-lime hover:bg-[#C0DF16]/5"
              >
                <span>
                  <span className="font-medium text-gray-700">{cfg.name}</span>
                  <span className="ml-2 text-gray-400">{cfg.quantity} шт.</span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-staleks-lime" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
