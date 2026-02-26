# ПОЛНОЕ ТЗ — Sprint 7: Конфигуратор-Админ в Next.js

## КРИТИЧЕСКАЯ ИНСТРУКЦИЯ

**ТЫ НЕ СОЗДАЁШЬ НИЧЕГО НОВОГО. ТЫ ПЕРЕНОСИШЬ СУЩЕСТВУЮЩИЙ ПРОТОТИП В NEXT.JS.**

Прочитай этот документ ПОЛНОСТЬЮ перед тем как написать хоть одну строчку кода.
У тебя есть:
1. **Работающий HTML-прототип** `prototype/configurator-admin.html` (~1510 строк) — ПРОЧИТАЙ ЕГО ПОЛНОСТЬЮ через Read tool
2. **Работающий фронтенд** на Next.js с модулями Заказы и Пользователи — ИЗУЧИ ИХ ПАТТЕРНЫ
3. **Работающий бэкенд API** — все эндпоинты уже существуют

**НЕ ВЫДУМЫВАЙ СВОИ СТРУКТУРЫ ДАННЫХ. ИСПОЛЬЗУЙ ТО, ЧТО ЕСТЬ В ПРОТОТИПЕ.**

---

## ЧТО НУЖНО СДЕЛАТЬ

### Фаза 1: Конфигуратор-Админ в Next.js (ПРИОРИТЕТ)

Перенести функционал из `prototype/configurator-admin.html` в Next.js приложение.
Создать страницу `/configurator` с 7 разделами из прототипа.

### Фаза 2: Доработки модуля Пользователи

Модуль пользователей УЖЕ СУЩЕСТВУЕТ и работает. Возможно потребуются мелкие правки.

### Фаза 3: Навигация и интеграция

Убедиться что все модули (Заказы, Конфигуратор, Пользователи) доступны из Sidebar.

---

## СТЕК ПРОЕКТА

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy async + asyncpg + PostgreSQL + Redis
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + axios + Montserrat font
- **Docker**: docker-compose (backend:8000, frontend:3000, postgres, redis)
- Запуск: `make up && make migrate && make seed && make seed-configurator`
- Логин: owner / ChangeMe123!

## БРЕНД И ДИЗАЙН

- Акцент: `#C0DF16` (лайм) → Tailwind: `staleks-lime`
- Sidebar: `#212322` → Tailwind: `staleks-sidebar`
- Фон: `#FAF9F5` → Tailwind: `staleks-bg`
- Muted: `#969C99` → Tailwind: `staleks-muted`
- Ошибки: `#DF1616` → Tailwind: `staleks-error`
- Шрифт: Montserrat (Google Fonts)
- Карточки: белые, rounded-xl, border border-gray-200, shadow нет (border вместо shadow)
- Таблицы: с thead bg-gray-50, hover:bg-gray-50 на строках

---

## СУЩЕСТВУЮЩАЯ СТРУКТУРА ФРОНТЕНДА

```
frontend/src/
  app/
    (dashboard)/
      layout.tsx          # Sidebar + AuthProvider wrapper
      orders/page.tsx     # Модуль заказов (РАБОТАЕТ)
      users/page.tsx      # Модуль пользователей (РАБОТАЕТ)
      configurator/       # НУЖНО СОЗДАТЬ
        page.tsx
  components/
    layout/
      Sidebar.tsx         # Навигация (уже есть пункт "Конфигуратор")
      Header.tsx          # Заголовок страницы
    orders/               # 5 компонентов (РАБОТАЕТ)
    users/                # 3 компонента (РАБОТАЕТ)
    configurator/         # НУЖНО СОЗДАТЬ
  contexts/
    AuthContext.tsx        # JWT auth, hasPermission(), hasRole()
  lib/
    api.ts                # axios instance с interceptors
    ordersApi.ts          # API обертки заказов
    usersApi.ts           # API обертки пользователей
    configuratorApi.ts    # API обертки конфигуратора (УЖЕ ЕСТЬ)
    utils.ts              # kzt(), apiError(), fmtDate()
  types/
    auth.ts               # User, Role, Permission
    orders.ts             # Order, OrderItem, OrderDoor
    configurator.ts       # DoorFieldDefinition, VisibilityRule, etc.
```

## ПАТТЕРН СТРАНИЦ (ОБЯЗАТЕЛЬНО СЛЕДОВАТЬ)

Каждая страница-модуль использует **state machine** паттерн:

```tsx
// page.tsx — тонкий оркестратор (~50 строк)
"use client";
import { useState } from "react";

type PageState =
  | { view: "list" }
  | { view: "create" }
  | { view: "edit"; item: SomeType };

export default function SomePage() {
  const [pageState, setPageState] = useState<PageState>({ view: "list" });
  const [listKey, setListKey] = useState(0);

  const refreshList = () => {
    setListKey(k => k + 1);
    setPageState({ view: "list" });
  };

  return (
    <div>
      <Header title="Заголовок" />
      <div className="p-6">
        {pageState.view === "list" && <ListView key={listKey} ... />}
        {pageState.view === "create" && <CreateForm ... />}
        {pageState.view === "edit" && <EditView ... />}
      </div>
    </div>
  );
}
```

## ЧТО ЕСТЬ В ПРОТОТИПЕ (prototype/configurator-admin.html)

### Навигация (7 разделов)
1. **Типы дверей** — CRUD таблица: code, label, shortLabel, enabled toggle
2. **Модели** — CRUD таблица с фильтром по типу, кнопка дублирования
3. **Секции** — сортируемый список с applicability по типам И моделям (modelApplicability)
4. **Поля** — основной раздел, таблица сгруппирована по секциям, модалка с 3 табами
5. **Правила видимости** — read-only обзор всех правил, редактирование и удаление
6. **Превью** — live рендер конфигуратора как видит менеджер
7. **Экспорт/Импорт** — JSON export/import + сброс к дефолтам

### Модель данных прототипа

```typescript
// Эти структуры УЖЕ В ПРОТОТИПЕ — не меняй их
interface DoorType {
  code: string;       // "technical", "finish", "complex"
  label: string;      // "Техническая", "С отделкой"
  shortLabel: string; // "Техн.", "Отд."
  enabled: boolean;
}

interface Model {
  code: string;       // "fire_ei30", "galant"
  label: string;      // "Противопожарная Ei-30"
  shortLabel: string; // "Ei-30"
  noExterior: boolean; // без наружной отделки
}

interface Group { // = Секция конфигуратора
  code: string;           // "dimensions", "construction"
  label: string;          // "Размеры", "Конструктив"
  icon: string;           // HTML entity "&#128207;"
  applicability: string[]; // ["technical"] или [] = для всех
  modelApplicability: string[]; // ["elite","venezia"] или [] = для всех
}

interface Field {
  code: string;          // "height_block"
  label: string;         // "Высота блока"
  type: string;          // "text" | "number" | "select" | "textarea" | "boolean" | "multiselect"
  group: string;         // "dimensions" (ссылка на Group.code)
  required: boolean;
  unit: string;          // "мм"
  placeholder: string;
  fullWidth: boolean;
  note: string;          // подсказка для менеджера
  applicability: string[]; // по типам дверей
  sortOrder: number;
  options: Array<{value: string, label: string}>;
  rules: Array<{
    dependsOn: string;   // код другого поля
    values: string[];    // при каких значениях
    rule: "show_when" | "hide_when";
  }>;
}
```

### Дефолтные данные (из прототипа)

**3 типа**: technical (Техническая), finish (С отделкой), complex (Сложная, disabled)

**11 моделей**:
- technical: tech_standard, fire_ei30, fire_ei60, fire_ei90, premium
- finish: galant (noExterior), modena (noExterior), elite, venezia, palermo, vinorit

**9 секций**: dimensions, construction, glass_transom, tech_specific (technical only), finish_exterior (finish only), finish_interior (finish only), hardware_apartment (finish only), marking, notes

**~53 поля** с опциями и правилами видимости (полный список в прототипе)

### Ключевые фичи прототипа

1. **Авто-транслитерация**: при вводе русского текста в label опции, автоматически генерируется латинский code
   ```
   "Пленка белая" → "plenka_belaya"
   ```
   Используется TRANSLIT_MAP: а→a, б→b, в→v, г→g и т.д.

2. **Bulk-ввод опций**: textarea, одна опция на строку. Формат: `value|Label` или просто `Label` (code генерируется автоматически)

3. **Дублирование модели**: кнопка 📋, создаёт копию с суффиксом `_copy`, сразу открывает редактор

4. **Model applicability секций**: `modelApplicability[]` — секция видна только для указанных моделей (если пустой — для всех)

5. **Превью с visibility engine**: выбор тип→модель, accordion-секции, поля с show_when/hide_when, auto-expand секций

6. **Persistence**: localStorage + JSON экспорт/импорт

---

## BACKEND API (УЖЕ СУЩЕСТВУЕТ)

### Auth API
```
POST /auth/login          # {username, password} → {access_token}
POST /auth/refresh        # HttpOnly cookie → {access_token}
POST /auth/logout
GET  /auth/me             # → User
POST /auth/change-password
GET  /auth/permissions    # → Permission[]
GET  /auth/roles          # → Role[]
```

### Users API
```
GET    /users                    # ?search=&role=&is_active=&page=&page_size= → PaginatedUsers
GET    /users/{id}               # → UserDetail
POST   /users                    # CreateUserPayload → UserDetail
PUT    /users/{id}               # UpdateUserPayload → UserDetail
DELETE /users/{id}               # деактивация
POST   /users/{id}/roles         # {role_ids[]} → UserDetail
```

### Configurator API
```
GET    /configurator/catalog                           # → {field_definitions, visibility_rules, groups}
GET    /configurator/configurations                    # → DoorConfiguration[]
POST   /configurator/configurations                    # → DoorConfiguration
GET    /configurator/configurations/{id}               # → DoorConfiguration
PATCH  /configurator/configurations/{id}               # → DoorConfiguration
DELETE /configurator/configurations/{id}

POST   /configurator/fields                            # FieldDefinitionCreate → DoorFieldDefinition
PATCH  /configurator/fields/{code}                     # FieldDefinitionUpdate → DoorFieldDefinition
DELETE /configurator/fields/{code}

GET    /configurator/visibility-rules                  # → VisibilityRule[]
POST   /configurator/visibility-rules                  # → VisibilityRule
DELETE /configurator/visibility-rules/{id}

GET    /configurator/pricing-rules                     # → PricingRule[]
POST   /configurator/pricing-rules                     # → PricingRule
PATCH  /configurator/pricing-rules/{id}                # → PricingRule
DELETE /configurator/pricing-rules/{id}

GET    /configurator/material-norms                    # → MaterialNorm[]
POST   /configurator/material-norms                    # → MaterialNorm
DELETE /configurator/material-norms/{id}
```

### Orders API
```
GET/POST   /orders                                     # CRUD заказов
GET/PATCH  /orders/{id}
DELETE     /orders/{id}
PATCH      /orders/{id}/status
GET        /orders/{id}/summary
POST       /orders/{id}/items                          # позиции
PATCH      /orders/{id}/items/{item_id}
DELETE     /orders/{id}/items/{item_id}
PATCH      /orders/{id}/items/{item_id}/status
POST       /orders/{id}/items/{item_id}/doors/generate # двери
PATCH      /orders/{id}/doors/{door_id}
PATCH      /orders/{id}/doors/{door_id}/status
PATCH      /orders/{id}/doors/batch-status
```

---

## СУЩЕСТВУЮЩИЕ ТИПЫ TYPESCRIPT

### types/auth.ts
```typescript
export interface Permission { id: string; code: string; description: string | null; module: string; }
export interface Role { id: string; name: string; display_name: string; description: string | null; is_system: boolean; permissions?: Permission[]; }
export interface User { id: string; username: string; full_name: string; email: string | null; phone: string | null; telegram_id: number | null; is_active: boolean; is_verified: boolean; last_login_at: string | null; created_at: string; roles: Role[]; permissions: string[]; }
export interface AuthContextValue { user: User | null; accessToken: string | null; isLoading: boolean; isAuthenticated: boolean; login: (u: string, p: string) => Promise<void>; logout: () => Promise<void>; hasPermission: (p: string) => boolean; hasRole: (r: string) => boolean; }
```

### types/configurator.ts (УЖЕ СУЩЕСТВУЕТ)
```typescript
export type DoorType = "technical" | "finish";
export type FieldType = "select" | "text" | "number" | "boolean" | "multiselect";
export type FieldLayer = "core" | "variant";
export type VisibilityRuleType = "show_when" | "hide_when";

export interface FieldOption { value: string; label: string; }

export interface DoorFieldDefinition {
  id: string; code: string; label: string; label_short: string | null;
  field_type: FieldType; group_code: string; group_label: string;
  sort_order: number; options: FieldOption[] | null; default_value: string | null;
  is_required: boolean; door_type_applicability: string[]; layer: FieldLayer;
  unit: string | null; notes: string | null; is_active: boolean;
}

export interface VisibilityRule {
  id: string; field_code: string; depends_on_field_code: string;
  depends_on_value: string | string[]; rule_type: VisibilityRuleType;
}

export interface ConfiguratorCatalog {
  field_definitions: DoorFieldDefinition[];
  visibility_rules: VisibilityRule[];
  groups: Array<{ code: string; label: string }>;
}

// + isFieldVisible(), filterFieldsByDoorType(), filterFieldsByLayer() helpers
```

### lib/configuratorApi.ts (УЖЕ СУЩЕСТВУЕТ)
Все CRUD обертки для полей, правил видимости, конфигураций, маркировок, ценообразования.

### lib/usersApi.ts (УЖЕ СУЩЕСТВУЕТ)
```typescript
export interface UserDetail { id, username, full_name, email, phone, telegram_id, is_active, is_verified, last_login_at, created_at, roles }
export interface PaginatedUsers { items: UserDetail[], total, page, page_size, pages }
export interface CreateUserPayload { username, full_name, password?, email?, phone?, telegram_id?, role_ids }
export interface UpdateUserPayload { full_name?, email?, phone?, telegram_id?, is_active? }
// listUsers, getUser, createUser, updateUser, deactivateUser, assignRoles, fetchRoles
```

---

## СУЩЕСТВУЮЩИЕ КОМПОНЕНТЫ

### layout/Header.tsx
```tsx
"use client";
import { useAuth } from "@/contexts/AuthContext";
interface HeaderProps { title: string; }
export function Header({ title }: HeaderProps) {
  const { user } = useAuth();
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      {user && <div className="text-sm text-gray-500">{user.full_name}</div>}
    </header>
  );
}
```

### layout/Sidebar.tsx
Уже содержит пункт "Конфигуратор" с href="/configurator" и permission="configurator:view".

### users/ — 3 компонента
- **UserListView** — таблица с поиском, фильтрами по роли и статусу, пагинацией
- **UserCreateForm** — форма создания (username, full_name, password, email, phone, roles)
- **UserEditView** — редактирование профиля + назначение ролей + блокировка

### orders/ — 5 компонентов (OrderListView, OrderCreateForm, OrderEditView, OrderFinancialSummary, DoorProgress)

---

## РОЛИ И ПРАВА (10 ролей, 34 права)

```
owner, admin, b2b_manager, b2c_manager, measurer, foreman, worker,
warehouse_manager, warehouse_worker, installation_foreman
```

Права конфигуратора: `configurator:view`, `configurator:edit`
Права пользователей: `auth:manage_users`, `auth:manage_roles`
Права заказов: `orders:read`, `orders:write`

---

## ПЛАН РЕАЛИЗАЦИИ

### Шаг 1: Создать страницу конфигуратора

Файл: `frontend/src/app/(dashboard)/configurator/page.tsx`

Для конфигуратора-админа паттерн немного другой — не list/create/edit, а **7 вкладок** (как в прототипе).
Используй state для activeTab.

### Шаг 2: Создать компоненты

```
frontend/src/components/configurator-admin/
  ConfiguratorAdminView.tsx     # Основной компонент с sidebar навигацией по вкладкам
  DoorTypesTab.tsx              # Типы дверей — таблица + inline CRUD
  ModelsTab.tsx                 # Модели — таблица с фильтром + модалка + дублирование
  SectionsTab.tsx               # Секции — сортируемый список + модалка
  FieldsTab.tsx                 # Поля — таблица + модалка с 3 табами (main/options/rules)
  RulesOverviewTab.tsx          # Обзор правил — read-only таблица
  PreviewTab.tsx                # Превью конфигуратора
  ExportImportTab.tsx           # Экспорт/импорт JSON
```

### Шаг 3: Подключить к API

Прототип работает с localStorage. В Next.js версии данные берутся из API:
- Загрузка: `GET /configurator/catalog` → field_definitions + visibility_rules + groups
- CRUD полей: `POST/PATCH/DELETE /configurator/fields/{code}`
- CRUD правил: `POST/DELETE /configurator/visibility-rules/{id}`

**ВАЖНО**: Backend API работает с `DoorFieldDefinition`, а прототип с упрощённой `Field` структурой. При переносе нужно маппить:
- `field.type` → `field_type`
- `field.group` → `group_code`
- `field.applicability` → `door_type_applicability`
- `field.required` → `is_required`
- `field.rules` → отдельные VisibilityRule записи в БД

### Шаг 4: Типы и модели

В текущем бэкенде типы и модели — enum'ы, не CRUD таблицы. Поэтому для MVP:
- **Типы и Модели** — хранить в localStorage как в прототипе (или в state)
- В будущем — добавить бэкенд таблицы

ИЛИ можно использовать JSON-хранение в конфигурации.

### Шаг 5: Превью

Рендерить форму конфигуратора на основе данных из state/API.
Движок видимости: `isFieldVisible()` из `types/configurator.ts`.

---

## КЛЮЧЕВЫЕ ПАТТЕРНЫ — НЕ ЛОМАЙ

1. **Все импорты из "@/"** (alias настроен в tsconfig)
2. **"use client"** на всех компонентах с state/hooks
3. **Tailwind CSS** — никаких inline styles или CSS modules
4. **lucide-react** для иконок (Search, Plus, Loader2, ArrowLeft, etc.)
5. **apiError()** из lib/utils.ts для обработки ошибок API
6. **useAuth()** для проверки прав
7. **Не используй** useRouter для навигации между вкладками — используй state
8. **Не создавай** новых API файлов если endpoint уже есть в configuratorApi.ts

## АНТИПАТТЕРНЫ — ИЗБЕГАЙ

1. **НЕ СОЗДАВАЙ** новые CSS файлы
2. **НЕ УСТАНАВЛИВАЙ** новые пакеты без необходимости
3. **НЕ МОДИФИЦИРУЙ** существующие работающие компоненты (orders/, users/)
4. **НЕ МЕНЯЙ** docker-compose.yml, миграции, бэкенд код
5. **НЕ ДЕЛАЙ** "Sprint 8" — делай ТОЛЬКО то, что описано здесь
6. **НЕ ВЫДУМЫВАЙ** свою структуру данных — бери из прототипа

---

## ПРОВЕРКА РЕЗУЛЬТАТА

1. `make up` — все контейнеры запускаются
2. Логин owner/ChangeMe123! → Sidebar → Конфигуратор
3. Видны 7 вкладок навигации
4. Типы дверей: добавить/изменить/удалить тип, toggle enabled
5. Модели: фильтр по типу, добавить/изменить/удалить/дублировать модель
6. Секции: перетащить вверх/вниз, изменить applicability (типы + модели)
7. Поля: добавить поле, настроить опции select (bulk-ввод + авто-транслитерация), добавить visibility rule
8. Правила: обзор всех правил, удаление из обзора
9. Превью: выбрать тип → модель → проверить что поля отображаются, visibility rules работают
10. Экспорт/Импорт: скачать JSON, загрузить обратно
11. Все модули (Заказы, Конфигуратор, Пользователи) доступны из Sidebar

---

## ПЕРВЫЙ ШАГ

Прочитай файлы в таком порядке:
1. `prototype/configurator-admin.html` — ПОЛНОСТЬЮ (1510 строк)
2. `frontend/src/app/(dashboard)/users/page.tsx` — паттерн страницы
3. `frontend/src/components/users/UserListView.tsx` — паттерн списка
4. `frontend/src/lib/configuratorApi.ts` — доступные API
5. `frontend/src/types/configurator.ts` — типы данных
6. `frontend/src/components/layout/Sidebar.tsx` — навигация

Потом начинай кодить, начиная с `page.tsx` и `ConfiguratorAdminView.tsx`.
