"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createUser, fetchRoles, type CreateUserPayload } from "@/lib/usersApi";
import { apiError } from "@/lib/utils";
import type { Role } from "@/types/auth";
import { Spinner, FormField, ErrorAlert } from "@/components/ui";

// --- Props ---

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

// --- Component ---

export function UserCreateForm({ onCreated, onCancel }: Props) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<Partial<CreateUserPayload>>({
    username: "",
    full_name: "",
    password: "",
    email: "",
    phone: "",
    role_ids: [],
  });

  useEffect(() => {
    fetchRoles().then(setRoles).catch(() => {});
  }, []);

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const toggleRole = (roleId: string) => {
    setForm((f) => {
      const current = f.role_ids || [];
      const next = current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId];
      return { ...f, role_ids: next };
    });
  };

  const handleSubmit = async () => {
    if (!form.username?.trim() || !form.full_name?.trim()) {
      setError("Логин и ФИО обязательны");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload: CreateUserPayload = {
        username: form.username!.trim(),
        full_name: form.full_name!.trim(),
        role_ids: form.role_ids || [],
      };
      if (form.password?.trim()) payload.password = form.password.trim();
      if (form.email?.trim()) payload.email = form.email.trim();
      if (form.phone?.trim()) payload.phone = form.phone.trim();
      if (form.telegram_id) payload.telegram_id = form.telegram_id;

      await createUser(payload);
      onCreated();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">Новый пользователь</h2>
        </div>

        <div className="space-y-4 px-6 py-5">
          <FormField label="Логин" required>
            <input
              type="text"
              value={form.username || ""}
              onChange={(e) => set("username", e.target.value)}
              placeholder="ivanov"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-400">
              Латинские буквы, цифры, точка, дефис, подчёркивание
            </p>
          </FormField>

          <FormField label="ФИО" required>
            <input
              type="text"
              value={form.full_name || ""}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Иванов Иван Иванович"
              className={inputCls}
            />
          </FormField>

          <FormField label="Пароль">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password || ""}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Минимум 8 символов (или оставьте пустым)"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Если не задан, будет сгенерирован автоматически
            </p>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email">
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="ivanov@example.com"
                className={inputCls}
              />
            </FormField>
            <FormField label="Телефон">
              <input
                type="text"
                value={form.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+7 (777) 123-45-67"
                className={inputCls}
              />
            </FormField>
          </div>

          <FormField label="Telegram ID">
            <input
              type="number"
              value={form.telegram_id || ""}
              onChange={(e) =>
                set("telegram_id", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="Числовой ID из Telegram"
              className={inputCls}
            />
          </FormField>

          <FormField label="Роли">
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => {
                const selected = (form.role_ids || []).includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selected
                        ? "border-staleks-lime bg-staleks-lime/20 text-staleks-sidebar"
                        : "border-gray-300 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {r.display_name}
                  </button>
                );
              })}
            </div>
          </FormField>

          {error && <ErrorAlert message={error} onClose={() => setError("")} />}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-5 py-2.5 text-sm font-semibold text-staleks-sidebar transition hover:brightness-95 disabled:opacity-50"
          >
            {saving && <Spinner size="sm" />}
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
