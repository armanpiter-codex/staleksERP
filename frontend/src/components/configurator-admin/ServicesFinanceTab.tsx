"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Check, X } from "lucide-react";
import { listServiceTypes, createServiceType, updateServiceType } from "@/lib/servicesApi";
import { apiError } from "@/lib/utils";
import type { ServiceType, ServiceTypeCreate, BillingMethod } from "@/types/services";
import { BILLING_METHOD_LABELS } from "@/types/services";

const ICON_OPTIONS = [
  { value: "ruler", label: "Линейка" },
  { value: "truck", label: "Грузовик" },
  { value: "wrench", label: "Ключ" },
  { value: "hammer", label: "Молоток" },
  { value: "hard-hat", label: "Каска" },
  { value: "package", label: "Коробка" },
  { value: "clipboard", label: "Планшет" },
];

export function ServicesFinanceTab() {
  const [items, setItems] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editBilling, setEditBilling] = useState<BillingMethod>("separate");
  const [editRequired, setEditRequired] = useState(false);

  // Create form state
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("ruler");
  const [newPrice, setNewPrice] = useState("0");
  const [newBilling, setNewBilling] = useState<BillingMethod>("separate");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listServiceTypes(true);
      setItems(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (st: ServiceType) => {
    setEditingId(st.id);
    setEditName(st.name);
    setEditIcon(st.icon || "");
    setEditPrice(st.default_price);
    setEditBilling(st.billing_method);
    setEditRequired(st.is_required);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    try {
      await updateServiceType(id, {
        name: editName,
        icon: editIcon || null,
        default_price: editPrice,
        billing_method: editBilling,
        is_required: editRequired,
      });
      setEditingId(null);
      load();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const toggleActive = async (st: ServiceType) => {
    try {
      await updateServiceType(st.id, { is_active: !st.is_active });
      load();
    } catch (err) {
      alert(apiError(err));
    }
  };

  const handleCreate = async () => {
    if (!newCode.trim() || !newName.trim()) {
      alert("Код и название обязательны");
      return;
    }
    try {
      const payload: ServiceTypeCreate = {
        code: newCode.trim(),
        name: newName.trim(),
        icon: newIcon || undefined,
        default_price: newPrice || "0",
        billing_method: newBilling,
      };
      await createServiceType(payload);
      setShowCreate(false);
      setNewCode("");
      setNewName("");
      setNewIcon("ruler");
      setNewPrice("0");
      setNewBilling("separate");
      load();
    } catch (err) {
      alert(apiError(err));
    }
  };

  if (loading) return <div className="py-8 text-center text-gray-400">Загрузка...</div>;
  if (error) return <div className="py-8 text-center text-red-500">{error}</div>;

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Типы услуг ({items.length})
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-3 py-1.5 text-xs font-semibold text-staleks-sidebar hover:opacity-90 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить услугу
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 rounded-lg border border-staleks-lime/30 bg-lime-50/30 p-4">
          <h4 className="mb-3 text-sm font-medium text-gray-700">Новая услуга</h4>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Код</label>
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="custom_service"
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Название</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название услуги"
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Иконка</label>
              <select
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              >
                {ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Цена по умолч.</label>
              <input
                type="number" min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Оплата</label>
              <select
                value={newBilling}
                onChange={(e) => setNewBilling(e.target.value as BillingMethod)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              >
                {(Object.entries(BILLING_METHOD_LABELS) as [BillingMethod, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-staleks-lime px-3 py-1.5 text-xs font-semibold text-staleks-sidebar">Создать</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border px-3 py-1.5 text-xs text-gray-500">Отмена</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Код</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Название</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Иконка</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Цена по умолч.</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Способ оплаты</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Обязат.</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Статус</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((st) => (
              <tr key={st.id} className={!st.is_active ? "opacity-50" : ""}>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{st.code}</td>
                <td className="px-4 py-2.5">
                  {editingId === st.id ? (
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
                  ) : st.name}
                </td>
                <td className="px-4 py-2.5 text-gray-400">
                  {editingId === st.id ? (
                    <select value={editIcon} onChange={(e) => setEditIcon(e.target.value)} className="rounded border px-2 py-1 text-sm">
                      {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : st.icon || "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {editingId === st.id ? (
                    <input type="number" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-24 rounded border px-2 py-1 text-right text-sm" />
                  ) : <span>{parseFloat(st.default_price).toLocaleString()} KZT</span>}
                </td>
                <td className="px-4 py-2.5">
                  {editingId === st.id ? (
                    <select value={editBilling} onChange={(e) => setEditBilling(e.target.value as BillingMethod)} className="rounded border px-2 py-1 text-sm">
                      {(Object.entries(BILLING_METHOD_LABELS) as [BillingMethod, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  ) : BILLING_METHOD_LABELS[st.billing_method]}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {editingId === st.id ? (
                    <input type="checkbox" checked={editRequired} onChange={(e) => setEditRequired(e.target.checked)} />
                  ) : st.is_required ? "Да" : "—"}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={() => toggleActive(st)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      st.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {st.is_active ? "Активна" : "Архив"}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {editingId === st.id ? (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => saveEdit(st.id)} className="rounded p-1 text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                      <button onClick={cancelEdit} className="rounded p-1 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(st)} className="rounded p-1 text-gray-400 hover:bg-gray-50"><Pencil className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Технолог настраивает типы услуг, которые менеджер может добавлять к заказам.
        Способ оплаты: &laquo;Отдельно&raquo; &mdash; строка в финансовой сводке,
        &laquo;В цене двери&raquo; &mdash; включена в стоимость,
        &laquo;Бесплатно&raquo; &mdash; показывается как 0.
      </p>
    </div>
  );
}
