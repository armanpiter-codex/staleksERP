"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Shield, UserCheck, UserX } from "lucide-react";
import {
  updateUser,
  assignRoles,
  deactivateUser,
  fetchRoles,
  type UserDetail,
  type UpdateUserPayload,
} from "@/lib/usersApi";
import { apiError, fmtDate } from "@/lib/utils";
import type { Role } from "@/types/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner, Badge, FormField, ErrorAlert } from "@/components/ui";
import { ROLE_COLORS } from "@/types/users";

// --- Props ---

interface Props {
  user: UserDetail;
  onBack: () => void;
  onUpdated: () => void;
}

// --- Component ---

export function UserEditView({ user, onBack, onUpdated }: Props) {
  const { user: currentUser, hasPermission } = useAuth();
  const canManageRoles = hasPermission("auth:manage_roles");

  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [telegramId, setTelegramId] = useState<string>(
    user.telegram_id ? String(user.telegram_id) : "",
  );

  // Roles
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    user.roles.map((r) => r.id),
  );

  useEffect(() => {
    if (canManageRoles) {
      fetchRoles().then(setAllRoles).catch(() => {});
    }
  }, [canManageRoles]);

  const isSelf = currentUser?.id === user.id;

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  // --- Save profile ---

  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: UpdateUserPayload = {};
      if (fullName !== user.full_name) payload.full_name = fullName;
      if (email !== (user.email || "")) payload.email = email || null;
      if (phone !== (user.phone || "")) payload.phone = phone || null;
      const tid = telegramId ? Number(telegramId) : null;
      if (tid !== user.telegram_id) payload.telegram_id = tid;

      await updateUser(user.id, payload);
      flash("Профиль сохранён");
      onUpdated();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  // --- Save roles ---

  const handleSaveRoles = async () => {
    setRolesLoading(true);
    setError("");
    try {
      await assignRoles(user.id, { role_ids: selectedRoleIds });
      flash("Роли обновлены");
      onUpdated();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setRolesLoading(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

  // --- Toggle active ---

  const handleToggleActive = async () => {
    if (isSelf) return;
    setSaving(true);
    setError("");
    try {
      if (user.is_active) {
        await deactivateUser(user.id);
        flash("Пользователь заблокирован");
      } else {
        await updateUser(user.id, { is_active: true });
        flash("Пользователь разблокирован");
      }
      onUpdated();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-staleks-lime";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 transition hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        К списку
      </button>

      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{user.full_name}</h2>
            <p className="text-sm text-gray-500">@{user.username}</p>
          </div>
          {user.is_active ? (
            <Badge variant="success" className="inline-flex items-center gap-1">
              <UserCheck className="h-3 w-3" /> Активен
            </Badge>
          ) : (
            <Badge variant="error" className="inline-flex items-center gap-1">
              <UserX className="h-3 w-3" /> Заблокирован
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-6 py-4 text-sm">
          <div className="text-gray-500">Создан</div>
          <div className="text-gray-800">{fmtDate(user.created_at)}</div>
          <div className="text-gray-500">Последний вход</div>
          <div className="text-gray-800">{fmtDate(user.last_login_at)}</div>
        </div>
      </div>

      {/* Profile form */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Профиль</h3>
        </div>
        <div className="space-y-4 px-6 py-4">
          <FormField label="ФИО">
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </FormField>
            <FormField label="Телефон">
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </FormField>
          </div>
          <FormField label="Telegram ID">
            <input type="number" value={telegramId} onChange={(e) => setTelegramId(e.target.value)} className={inputCls} />
          </FormField>
          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-5 py-2 text-sm font-semibold text-staleks-sidebar transition hover:brightness-95 disabled:opacity-50"
            >
              {saving && <Spinner size="sm" />}
              Сохранить
            </button>
          </div>
        </div>
      </div>

      {/* Roles */}
      {canManageRoles && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-3">
            <Shield className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Роли</h3>
          </div>
          <div className="px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {allRoles.map((r) => {
                const selected = selectedRoleIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      selected
                        ? `border-transparent ${ROLE_COLORS[r.name] || "bg-gray-200 text-gray-800"}`
                        : "border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {r.display_name}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveRoles}
                disabled={rolesLoading}
                className="flex items-center gap-1.5 rounded-lg bg-staleks-lime px-5 py-2 text-sm font-semibold text-staleks-sidebar transition hover:brightness-95 disabled:opacity-50"
              >
                {rolesLoading && <Spinner size="sm" />}
                Сохранить роли
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Действия</h3>
        </div>
        <div className="space-y-3 px-6 py-4">
          {!isSelf && (
            <button
              onClick={handleToggleActive}
              disabled={saving}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                user.is_active
                  ? "border-red-200 text-red-700 hover:bg-red-50"
                  : "border-green-200 text-green-700 hover:bg-green-50"
              }`}
            >
              {user.is_active ? "Заблокировать пользователя" : "Разблокировать пользователя"}
            </button>
          )}
          {isSelf && (
            <p className="text-center text-xs text-gray-400">Нельзя заблокировать свой аккаунт</p>
          )}
        </div>
      </div>

      {/* Feedback */}
      {error && <ErrorAlert message={error} onClose={() => setError("")} />}
      {success && <p className="text-sm font-medium text-green-600">{success}</p>}
    </div>
  );
}
