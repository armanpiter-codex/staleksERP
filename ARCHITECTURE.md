# Staleks ERP -- Architecture Guide

This document is the single source of truth for code organization.
Every Claude Code session MUST read and follow these rules.

---

## 1. Module Contract

### 1.1 Backend Module (`backend/app/{module}/`)

```
{module}/
  __init__.py          # Empty
  models.py            # SQLAlchemy ORM models + enums       (max 400 lines)
  schemas.py           # Pydantic request/response schemas   (max 350 lines)
  router.py            # FastAPI APIRouter endpoints          (max 400 lines)
  service.py           # Business logic                      (max 400 lines)
```

When service.py exceeds 400 lines, split into a `services/` directory:

```
{module}/
  services/
    __init__.py        # Re-exports: from .crud import *
    crud.py
    workflow.py
    pricing.py
```

The `__init__.py` must re-export everything so router imports stay unchanged:
```python
# {module}/services/__init__.py
from app.{module}.services.crud import *
from app.{module}.services.workflow import *
```

**Established backend patterns (DO NOT change):**

Service function signature -- db first, keyword-only args after:
```python
async def get_orders(
    db: AsyncSession,
    *,
    status: OrderStatus | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedResponse[OrderListSchema]:
```

Router endpoint -- dependencies via Depends:
```python
@router.get("/", response_model=PaginatedResponse[OrderListSchema])
async def list_orders(
    status: OrderStatus | None = Query(default=None),
    current_user: TokenPayload = Depends(require_permission("orders:read")),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_orders(db, status=status)
```

Permission checking:
```python
from app.auth.dependencies import require_permission, require_any_permission
# require_permission("orders:read")     -- exact match
# require_any_permission("a:x", "b:y")  -- any of
```

Exceptions:
```python
from app.common.exceptions import (
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
)
```

Pagination:
```python
from app.common.pagination import PaginatedResponse, PaginationParams
```

Async pattern -- re-fetch after commit (MissingGreenlet fix):
```python
await db.commit()
result = await db.execute(
    select(Order).where(Order.id == order_id).options(selectinload(Order.items))
)
return result.scalar_one()
```

Migrations -- raw SQL DDL with idempotent enums:
```python
op.execute(sa.text("""
    DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('draft', 'active');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
"""))
```

### 1.2 Frontend Module

```
src/
  app/(dashboard)/{feature}/
    page.tsx                               # Thin orchestrator (max 80 lines)

  components/{feature}/
    index.ts                               # Barrel exports (REQUIRED)
    {Feature}ListView.tsx                  # List view (max 350 lines)
    {Feature}CreateForm.tsx                # Create form (max 300 lines)
    {Feature}EditView.tsx                  # Edit view (max 350 lines)
    sections/                              # Sub-sections of large views
      {Feature}HeaderSection.tsx           # (max 200 lines)
      {Feature}ItemsSection.tsx            # (max 200 lines)

  lib/{feature}Api.ts                      # API wrappers (max 350 lines)
  types/{feature}.ts                       # Types, enums, label/color maps (max 400 lines)
  hooks/use{Feature}.ts                    # Feature hooks (max 150 lines, optional)
```

**Gold standard page pattern** (from `orders/page.tsx`, 51 lines):
```tsx
"use client";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { FeatureListView } from "@/components/feature/FeatureListView";
import { FeatureCreateForm } from "@/components/feature/FeatureCreateForm";
import { FeatureEditView } from "@/components/feature/FeatureEditView";
import type { Feature } from "@/types/feature";

type PageState =
  | { view: "list" }
  | { view: "create" }
  | { view: "edit"; item: Feature };

export default function FeaturePage() {
  const [pageState, setPageState] = useState<PageState>({ view: "list" });
  return (
    <div>
      <Header title="..." />
      <div className="p-6">
        {pageState.view === "list" && (
          <FeatureListView
            onOpenCreate={() => setPageState({ view: "create" })}
            onOpenEdit={(item) => setPageState({ view: "edit", item })}
          />
        )}
        {pageState.view === "create" && (
          <FeatureCreateForm
            onCreated={(item) => setPageState({ view: "edit", item })}
            onCancel={() => setPageState({ view: "list" })}
          />
        )}
        {pageState.view === "edit" && (
          <FeatureEditView
            key={pageState.item.id}
            item={pageState.item}
            onBack={() => setPageState({ view: "list" })}
          />
        )}
      </div>
    </div>
  );
}
```

**API wrapper pattern** (from `ordersApi.ts`):
```tsx
import api from "@/lib/api";
import type { Order, OrderCreate } from "@/types/orders";

const BASE = "/orders";

export async function listOrders(params?: ListOrdersParams): Promise<PaginatedOrders> {
  const { data } = await api.get<PaginatedOrders>(BASE, { params });
  return data;
}

export async function createOrder(payload: OrderCreate): Promise<Order> {
  const { data } = await api.post<Order>(BASE, payload);
  return data;
}
```

**Barrel export pattern** (from `components/orders/index.ts`):
```tsx
export { OrderListView } from "./OrderListView";
export { OrderCreateForm } from "./OrderCreateForm";
export { OrderEditView } from "./OrderEditView";
export { OrderFinancialSummary } from "./OrderFinancialSummary";
export { DoorProgress } from "./DoorProgress";
```

---

## 2. File Size Limits

| File Type | Soft Limit | Hard Limit | Action |
|-----------|-----------|------------|--------|
| Backend service.py | 300 | 400 | Split into services/ |
| Backend router.py | 300 | 400 | Split into routers/ |
| Backend models.py | 300 | 400 | Rarely needs splitting |
| Backend schemas.py | 250 | 350 | Split by entity |
| Frontend page.tsx | 50 | 80 | Extract to components |
| Frontend View component | 250 | 350 | Extract sections/ |
| Frontend Form component | 200 | 300 | Extract field groups |
| Frontend Section | 150 | 200 | Break down further |
| Frontend UI component | 80 | 150 | Keep focused |
| Frontend types/*.ts | 300 | 400 | Split by entity |
| Frontend *Api.ts | 200 | 350 | Already fine |
| Frontend hooks | 80 | 150 | One concern per hook |

**If a file exceeds the hard limit, it MUST be decomposed before adding more code.**

---

## 3. Component Hierarchy (Frontend)

```
Page (max 80)      -- state machine, route-level orchestration
  View (max 350)   -- feature-level, data loading, state coordination
    Section (max 200) -- logical grouping (items, financial, client)
      UI (max 150)    -- reusable primitive, zero business logic
```

### Extraction Rules

**MUST extract when:**
- JSX block exceeds 50 lines
- Block has its own useState/useEffect independent of parent
- Block is repeated in 2+ places
- Each tab in a tabbed interface = separate component (ALWAYS)

**Keep inline when:**
- Under 20 lines of JSX
- No independent state
- Used exactly once
- Tightly coupled to parent state

---

## 4. UI Component Library (`/components/ui/`)

Reusable, business-logic-free primitives. Used across 2+ modules.

### Required Components

```
components/ui/
  index.ts              # Barrel exports
  Badge.tsx             # variant: default|success|warning|error|info
  Button.tsx            # variant: primary|secondary|danger|ghost, size: sm|md|lg
  Modal.tsx             # title, children, onConfirm, onCancel
  Spinner.tsx           # Loader2 animate-spin
  EmptyState.tsx        # icon + message
  FormField.tsx         # label + input wrapper
  TabBar.tsx            # tabs array + activeTab + onChange
  StatusBadge.tsx       # accepts label/color maps
  SaveCancelRow.tsx     # Save + Cancel buttons
  ErrBanner.tsx         # Error notification
```

### UI Component Rules

- ZERO business logic
- Props-driven
- Uses `clsx` for conditional Tailwind classes
- Brand palette: `staleks-lime`, `staleks-sidebar`, `staleks-bg`, `staleks-muted`, `staleks-error`
- Font: Montserrat via `font-montserrat`

### What does NOT go in `/components/ui/`

- Components that import from `lib/*Api.ts`
- Components that use `useAuth()` or check permissions
- Components with domain-specific types (Order, DoorConfiguration)
- Components that make API calls

### UI Component Pattern

```tsx
interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={clsx(
      "rounded-full px-2 py-0.5 text-xs font-medium",
      VARIANT_CLASSES[variant],
      className,
    )}>
      {children}
    </span>
  );
}
```

---

## 5. Dependency Direction

### Backend

```
common/         <-- foundation (exceptions, pagination, redis)
  |
auth/           <-- security layer (dependencies, security, schemas)
  |
configurator/   <-- domain (field definitions, visibility rules)
  |
orders/         <-- domain (orders, items, doors -- uses configurator)
  |
production/     <-- domain (future -- uses orders)
```

**Rules:**
- `common/` imports from NO other app module
- `auth/` imports from `common/` only
- `configurator/` imports from `common/` and `auth/`
- `orders/` may import from `configurator/` (DoorConfiguration, pricing)
- NO circular imports. Shared concerns go to `common/`

### Frontend

```
types/              <-- pure type definitions
  |
lib/api.ts          <-- axios instance
  |
lib/*Api.ts         <-- API wrappers (import types/ and lib/api)
  |
hooks/              <-- custom hooks (import contexts, lib/)
  |
components/ui/      <-- primitives (NO feature imports)
  |
components/{feat}/  <-- feature components (import ui/, hooks/, lib/*Api, types/)
  |
app/(dashboard)/    <-- pages (import components/{feat}/, layout/)
```

**Rules:**
- `types/` NEVER imports from `components/` or `lib/`
- `lib/*Api.ts` NEVER imports from `components/`
- `components/ui/` NEVER imports from `components/{feature}/`, `lib/*Api.ts`, or `contexts/`
- Feature components do NOT import from another feature's API layer
- Cross-module data flows via props from parent page

---

## 6. Naming Conventions

### Backend (Python)

| What | Convention | Example |
|------|-----------|---------|
| Module dir | snake_case | `orders/`, `configurator/` |
| Files | snake_case | `service.py`, `models.py` |
| ORM models | PascalCase | `Order`, `OrderItem`, `OrderDoor` |
| Enum classes | PascalCase | `OrderStatus`, `DoorStatus` |
| Pydantic schemas | PascalCase | `OrderCreateSchema`, `OrderListSchema` |
| Service functions | snake_case, verb prefix | `get_orders`, `create_order` |
| Private helpers | _prefix | `_recalculate_total` |
| Constants | UPPER_SNAKE | `ALLOWED_ORDER_TRANSITIONS` |
| Permission codes | colon-separated | `"orders:read"`, `"auth:manage_users"` |
| DB tables | plural snake_case | `orders`, `order_items` |
| DB columns | snake_case | `client_name`, `created_at` |

### Frontend (TypeScript/React)

| What | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase.tsx | `OrderEditView.tsx` |
| Component names | PascalCase | `export function OrderEditView()` |
| Page files | lowercase page.tsx | `orders/page.tsx` |
| Hooks | camelCase, use prefix | `usePermission.ts`, `useAuth()` |
| API wrappers | camelCase + Api | `ordersApi.ts`, `configuratorApi.ts` |
| API functions | camelCase, verb prefix | `listOrders`, `createOrder` |
| Type files | camelCase | `types/orders.ts` |
| Interfaces | PascalCase, no I prefix | `Order`, `OrderCreate` |
| Label maps | `{ENTITY}_STATUS_LABELS` | `ORDER_STATUS_LABELS` |
| Color maps | `{ENTITY}_STATUS_COLORS` | `DOOR_STATUS_COLORS` |
| Transition maps | `{ENTITY}_STATUS_NEXT` | `ORDER_STATUS_NEXT` |
| CSS | Tailwind only + clsx | No CSS modules, no styled-components |
| Barrel exports | index.ts | Named exports only, no default |

### Section Headers in Files

```python
# Python:
# --- CRUD --------------------------------
# --- Workflow ----------------------------
# --- Helpers -----------------------------
```

```tsx
// TypeScript:
// --- Enums -------
// --- Interfaces --
// --- Constants ---
```

---

## 7. Shared Utilities

### Backend (`app/common/`)

| File | Purpose | Used by |
|------|---------|---------|
| `exceptions.py` | NotFoundException, ForbiddenException, BadRequestException, ConflictException | All modules |
| `pagination.py` | PaginatedResponse[T], PaginationParams | All modules with lists |
| `redis_client.py` | get_redis(), close_redis() | Auth (revocation), future caching |

### Frontend (`lib/`)

| File | Purpose |
|------|---------|
| `api.ts` | Axios instance, auth interceptor, auto-refresh on 401 |
| `utils.ts` | kzt(), apiError(), fmtDate(), fmtDateShort(), totalDoors() |
| `constants.ts` | PERMISSIONS, ROLES, API_BASE_URL |

---

## 8. Session Protocol

When starting a new Claude Code session for any module:

1. **Read** this ARCHITECTURE.md before making any changes
2. **Scope** -- work only within the target module's files
3. **Limits** -- check file sizes before and after changes
4. **UI** -- use `@/components/ui/` for reusable elements (create if missing)
5. **Exports** -- create/update barrel exports (index.ts)
6. **No cross-module edits** without explicit instruction from the user
7. **Preserve** established patterns (see Section 1)

---

## 9. Current Violations

Files that exceed hard limits and need refactoring:

| # | File | Lines | Limit | Priority |
|---|------|-------|-------|----------|
| 1 | `frontend/src/app/(dashboard)/configurator/admin/page.tsx` | 1146 | 80 | HIGH |
| 2 | `frontend/src/app/(dashboard)/settings/page.tsx` | 938 | 80 | HIGH |
| 3 | `frontend/src/components/orders/OrderEditView.tsx` | 890 | 350 | HIGH |
| 4 | `backend/app/orders/service.py` | 851 | 400 | HIGH |
| 5 | `backend/app/configurator/service.py` | 743 | 400 | HIGH |
| 6 | `frontend/src/app/(dashboard)/configurator/page.tsx` | 510 | 80 | MEDIUM |
| 7 | `backend/app/configurator/router.py` | 499 | 400 | MEDIUM |

---

## 10. Refactoring Plan

Ordered by dependency (each step is one focused session):

### Step 1: UI Component Library (foundation)
Create `components/ui/` with ~10 primitives extracted from existing duplicated code in settings and configurator admin pages. Create barrel export.

### Step 2: settings/page.tsx (938 -> ~40 lines)
Extract 4 tab components to `components/settings/`. Page becomes TabBar + switch.

### Step 3: configurator/admin/page.tsx (1146 -> ~40 lines)
Extract tab components to `components/configurator-admin/`. Page becomes TabBar + switch.

### Step 4: OrderEditView.tsx (890 -> ~250 lines)
Extract 7 sections to `components/orders/sections/`. View remains orchestrator.

Target structure:
```
components/orders/sections/
  OrderHeaderSection.tsx       (max 100)
  OrderItemsSection.tsx        (max 200)
  OrderItemRow.tsx             (max 150)
  OrderDoorsTable.tsx          (max 200)
  OrderClientSection.tsx       (max 80)
  OrderServicesSection.tsx     (max 80)
  AddItemFromTemplate.tsx      (max 150)
```

### Step 5: orders/service.py (851 -> 5 files)
```
orders/services/
  __init__.py     # re-exports
  crud.py         # get_orders, get_order, create_order, update_order, delete_order
  workflow.py     # transition_order_status, transition_item_status + constants
  items.py        # add_item, update_item, remove_item
  doors.py        # generate_doors, transition_door_status, batch, toggle_priority
  pricing.py      # _recalculate_total, get_order_summary
```

### Step 6: configurator/service.py (743 -> 5 files)
```
configurator/services/
  __init__.py
  catalog.py           # field definitions CRUD, visibility rules
  configurations.py    # configuration CRUD, duplication
  pricing.py           # price calculation
  bom.py               # bill of materials, formulas
  rules.py             # pricing rules, material norms
```

### Step 7: configurator/page.tsx (510 -> ~60 lines)
Extract remaining inline sections to `components/configurator/`.
