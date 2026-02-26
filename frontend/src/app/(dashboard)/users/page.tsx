"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { UserListView } from "@/components/users/UserListView";
import { UserCreateForm } from "@/components/users/UserCreateForm";
import { UserEditView } from "@/components/users/UserEditView";
import type { UserDetail } from "@/lib/usersApi";

// ─── Page State Machine ──────────────────────────────────────────────────────

type PageState =
  | { view: "list" }
  | { view: "create" }
  | { view: "edit"; user: UserDetail };

// ─── Page Component ──────────────────────────────────────────────────────────

export default function UsersPage() {
  const [pageState, setPageState] = useState<PageState>({ view: "list" });
  const [listKey, setListKey] = useState(0);

  const refreshList = () => {
    setListKey((k) => k + 1);
    setPageState({ view: "list" });
  };

  return (
    <div>
      <Header title="Пользователи" />
      <div className="p-6">
        {pageState.view === "list" && (
          <UserListView
            key={listKey}
            onOpenCreate={() => setPageState({ view: "create" })}
            onOpenEdit={(user) => setPageState({ view: "edit", user })}
          />
        )}

        {pageState.view === "create" && (
          <UserCreateForm
            onCreated={refreshList}
            onCancel={() => setPageState({ view: "list" })}
          />
        )}

        {pageState.view === "edit" && (
          <UserEditView
            key={pageState.user.id}
            user={pageState.user}
            onBack={() => setPageState({ view: "list" })}
            onUpdated={refreshList}
          />
        )}
      </div>
    </div>
  );
}
