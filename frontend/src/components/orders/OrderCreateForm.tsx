"use client";

import { useState, useEffect } from "react";
import { createOrder, getUsersByRole } from "@/lib/ordersApi";
import { listFacilities, createFacility } from "@/lib/facilitiesApi";
import { apiError } from "@/lib/utils";
import type { Order, OrderCreate, ClientType, SalesChannel, UserBrief, Facility } from "@/types/orders";
import { CLIENT_TYPE_LABELS } from "@/types/orders";
import { Building2, Calendar, Loader2, MapPin, Plus, Ruler, X } from "lucide-react";
import clsx from "clsx";

interface OrderCreateFormProps {
  onCreated: (order: Order) => void;
  onCancel: () => void;
}

export function OrderCreateForm({ onCreated, onCancel }: OrderCreateFormProps) {
  const [form, setForm] = useState<Partial<OrderCreate>>({
    client_type: "b2b",
    sales_channel: "corporate",
    vat_rate: "16",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [measurers, setMeasurers] = useState<UserBrief[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [showNewFacility, setShowNewFacility] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState("");
  const [savingFacility, setSavingFacility] = useState(false);

  useEffect(() => {
    getUsersByRole("measurer")
      .then(setMeasurers)
      .catch(() => {
        getUsersByRole("owner").then(setMeasurers).catch(console.error);
      });
    listFacilities().then(setFacilities).catch(console.error);
  }, []);

  const handleCreateFacility = async () => {
    if (!newFacilityName.trim()) return;
    setSavingFacility(true);
    try {
      const f = await createFacility(newFacilityName.trim());
      setFacilities((prev) => [...prev, f].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, facility_id: f.id }));
      setShowNewFacility(false);
      setNewFacilityName("");
    } catch (err) {
      alert(apiError(err));
    } finally {
      setSavingFacility(false);
    }
  };

  const handleCreate = async () => {
    if (!form.client_name?.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const payload: OrderCreate = { ...(form as OrderCreate) };
      if (!payload.client_phone) payload.client_phone = null;
      if (!payload.client_email) payload.client_email = null;
      if (!payload.client_company) payload.client_company = null;
      if (!payload.object_name) payload.object_name = null;
      if (!payload.facility_id) payload.facility_id = null;
      if (!payload.source) payload.source = null;
      if (!payload.delivery_address) payload.delivery_address = null;
      if (!payload.notes) payload.notes = null;

      const order = await createOrder(payload);
      onCreated(order);
    } catch (err) {
      setCreateError(apiError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Новый заказ</h2>
        <button onClick={onCancel} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        {/* Channel */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Канал продаж</label>
          <div className="flex gap-3">
            {(["b2b", "b2c"] as ClientType[]).map((ct) => (
              <button
                key={ct}
                onClick={() => setForm((f) => ({ ...f, client_type: ct, sales_channel: ct === "b2b" ? "corporate" : "retail" }))}
                className={clsx(
                  "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                  form.client_type === ct
                    ? "border-staleks-lime bg-[#C0DF16]/10 text-staleks-sidebar"
                    : "border-gray-200 text-gray-600 hover:border-staleks-lime/50"
                )}
              >
                {CLIENT_TYPE_LABELS[ct]}
              </button>
            ))}
          </div>
        </div>

        {form.client_type === "b2b" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Тип канала</label>
            <select
              value={form.sales_channel ?? "corporate"}
              onChange={(e) => setForm((f) => ({ ...f, sales_channel: e.target.value as SalesChannel }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            >
              <option value="corporate">Корпоративный</option>
              <option value="dealer">Дилерский</option>
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            ФИО / Контактное лицо <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.client_name ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
            placeholder="Иванов Иван Иванович"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          />
        </div>

        {form.client_type === "b2b" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Компания / Застройщик</label>
              <input
                type="text"
                value={form.client_company ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, client_company: e.target.value }))}
                placeholder="ТОО Строй Инвест"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  <Building2 className="mr-1 inline h-4 w-4" />Объект
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewFacility(!showNewFacility)}
                  className="flex items-center gap-1 text-xs text-staleks-sidebar hover:text-staleks-lime"
                >
                  <Plus className="h-3 w-3" />Новый объект
                </button>
              </div>
              {showNewFacility ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFacilityName}
                    onChange={(e) => setNewFacilityName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateFacility(); if (e.key === "Escape") setShowNewFacility(false); }}
                    placeholder="Название объекта"
                    autoFocus
                    className="flex-1 rounded-lg border border-staleks-lime px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
                  />
                  <button
                    type="button"
                    onClick={handleCreateFacility}
                    disabled={savingFacility || !newFacilityName.trim()}
                    className="rounded-lg bg-staleks-lime px-3 py-2 text-xs font-semibold text-staleks-sidebar disabled:opacity-50"
                  >
                    {savingFacility ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
                  </button>
                  <button type="button" onClick={() => setShowNewFacility(false)} className="p-2 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <select
                  value={form.facility_id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, facility_id: e.target.value || null }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
                >
                  <option value="">Без объекта</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Телефон</label>
            <input
              type="tel"
              value={form.client_phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value || null }))}
              placeholder="+7 (777) 000-00-00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={form.client_email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value || null }))}
              placeholder="client@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            <Ruler className="mr-1 inline h-4 w-4" />Замерщик
          </label>
          <select
            value={form.measurer_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, measurer_id: e.target.value || null }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          >
            <option value="">Не назначен</option>
            {measurers.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Скидка (%)</label>
            <input
              type="number" min="0" max="100"
              value={form.discount_percent ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, discount_percent: e.target.value || null }))}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Предоплата</label>
            <input
              type="number" min="0"
              value={form.prepayment_amount ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, prepayment_amount: e.target.value || null }))}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Отсрочка (дн.)</label>
            <input
              type="number" min="0"
              value={form.credit_days ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, credit_days: e.target.value ? Number(e.target.value) : null }))}
              placeholder="30"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">НДС (%)</label>
            <input
              type="number" min="0" max="100"
              value={form.vat_rate ?? "16"}
              onChange={(e) => setForm((f) => ({ ...f, vat_rate: e.target.value || "16" }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Источник</label>
            <input
              type="text"
              value={form.source ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value || null }))}
              placeholder="tender-samruk, instagram"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            <MapPin className="mr-1 inline h-4 w-4" />Адрес доставки
          </label>
          <input
            type="text"
            value={form.delivery_address ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value || null }))}
            placeholder="Алматы, ул. Сейфуллина 404"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            <Calendar className="mr-1 inline h-4 w-4" />Желаемая дата доставки
          </label>
          <input
            type="date"
            value={form.desired_delivery_date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, desired_delivery_date: e.target.value || null }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Примечание</label>
          <textarea
            rows={2}
            value={form.notes ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime"
          />
        </div>

        {createError && <p className="text-sm text-staleks-error">{createError}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCreate}
            disabled={creating || !form.client_name?.trim()}
            className="flex items-center gap-2 rounded-lg bg-staleks-lime px-5 py-2.5 text-sm font-semibold text-staleks-sidebar transition-colors hover:bg-staleks-lime-dark disabled:opacity-50"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать заказ
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
