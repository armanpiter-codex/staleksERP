# Sprint 2 — OrderItem + OrderDoor + Brand Rebrand

## 1. Контекст и цель

**Компания**: Staleks / AlCom Engineering Group — производство кастомизированных стальных дверей.
**ERP стек**: Python 3.12 + FastAPI + SQLAlchemy async + PostgreSQL + Redis (backend), Next.js 15 + TypeScript + Tailwind (frontend), Docker.
**Текущее состояние**: Реализованы auth, конфигуратор дверей, модуль заказов (Sprint 1).

### Проблемы текущей архитектуры:

1. **Нельзя дозаказать** — конфигурации привязываются к заказу напрямую через `order_id` на `DoorConfiguration`. Нет понятия "позиция в заказе" с отдельным количеством.

2. **Нельзя частично запустить/отгрузить** — весь заказ двигается по одному статусу. Реальность: из 100 дверей запустили 50, изготовили 30, отгрузили 30. Каждая дверь на своём этапе.

3. **Маркировки привязаны к конфигурации навсегда** — одинаковые двери на разных объектах имеют разную маркировку (у строителей свои внутренние номера при проектировании). Маркировка должна быть атрибутом двери в контексте конкретного заказа.

4. **Нет фирменного стиля** — UI использует оранжевые цвета по умолчанию вместо брендовых цветов Staleks.

### Бизнес-сценарий (реальный пример):

> Договор на 240 дверей для ЖК "Алатау Резиденс". Заказали на изготовление 1-й блок — 3 подъезда — 100 дверей. Предоплата на все 240. Из 100 запустили только 50 (часть ждёт сырьё). Из 50 изготовили 30. Строители не могут ждать — отгружаем что готово. Бригадир-МОП просит приоритизировать конкретные 30 дверей из 50 (нет стройготовности для остальных). Отменить заказ нельзя после запуска в производство.

### Ключевые уточнения заказчика:

- **Маркировка ≠ статус двери**. Маркировка — информация для строителей/монтажников (куда ставить дверь). Статус — отслеживание двери через производство. Это разные вещи на одной сущности.
- **Каждая дверь имеет уникальный внутренний номер** — для внутреннего учёта, не зависит от маркировки.
- **Нужны ОБА уровня статусов** — на позиции (для менеджера) И на каждой двери (для производства).
- **Маркировки**: генерация пакетом + ручная доработка МОПом (этаж, подъезд, квартира).
- **Статус "Готово к отгрузке"** — отдельный от "Отгружено" (дверь изготовлена, ждёт на складе).
- **Приоритет** — влияет на очередь производства, МОП ставит на конкретные двери.

---

## 2. Архитектура (три уровня)

```
Order (заказ — B2B-2026-0001)
│   status: draft → measurement → active → completed → cancelled
│
├── OrderItem #1 (позиция — "Техническая 900×2100", 100 шт)
│   │   status: draft → confirmed → in_production → ready_for_shipment → shipped → completed
│   │   locked_price: 166,172 ₸
│   │   priority: true
│   │
│   ├── OrderDoor D-00001 (marking: "Д1-001", 1 этаж, Пятно 1, кв.1) → shipped
│   ├── OrderDoor D-00002 (marking: "Д1-002", 1 этаж, Пятно 1, кв.2) → ready_for_shipment ⚡
│   ├── OrderDoor D-00003 (marking: "Д1-003", 1 этаж, Пятно 1, кв.3) → in_production
│   ├── ...
│   ├── OrderDoor D-00050 (marking: "Д1-050", 5 этаж, Пятно 1, кв.50) → pending
│   └── OrderDoor D-00100 (marking: не заполнена) → pending
│
├── OrderItem #2 (позиция — "Финишная 1000×2100", 80 шт)
│   │   status: confirmed
│   │   ...
│
└── OrderItem #3 (позиция — "Техническая ДМП 1200×2100", 60 шт)
        status: draft
```

### Соотношение статусов:

| Уровень | Кто ставит | Для чего |
|---------|-----------|----------|
| **Заказ** (Order) | Менеджер | Общий жизненный цикл: заключение → замер → работа → закрытие |
| **Позиция** (OrderItem) | Менеджер | Управление группой одинаковых дверей: подтверждение, запуск, отгрузка |
| **Дверь** (OrderDoor) | Производство / МОП | Отслеживание каждой физической двери: где она сейчас |

Статусы позиции и дверей — **независимые**. Позиция может быть "В производстве", а внутри 30 дверей уже "Готово к отгрузке".

---

## 3. Модели данных (подробно)

### 3.1 Order (изменения в существующей модели)

**Файл**: `backend/app/orders/models.py`

Изменения в enum `OrderStatus`:
```python
class OrderStatus(str, enum.Enum):
    draft = "draft"              # Черновик
    measurement = "measurement"  # Замер
    active = "active"            # Активный (цены зафиксированы)
    completed = "completed"      # Завершён
    cancelled = "cancelled"      # Отменён
    # Legacy (в DB enum есть, в коде не используются):
    confirmed = "confirmed"
    in_production = "in_production"
    shipped = "shipped"
```

Замена relationship `configurations` на `items`:
```python
# БЫЛО:
configurations = relationship("DoorConfiguration", primaryjoin=..., viewonly=False)

# СТАЛО:
items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan",
                     lazy="selectin", order_by="OrderItem.position_number")
```

### 3.2 OrderItem (НОВАЯ модель)

**Таблица**: `order_items`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID PK | |
| order_id | UUID FK → orders | CASCADE DELETE |
| configuration_id | UUID FK → door_configurations | RESTRICT DELETE |
| position_number | INTEGER | Порядковый номер в заказе (1, 2, 3...) |
| quantity | INTEGER | Общее количество дверей в позиции |
| status | order_item_status_enum | Статус позиции (ставится менеджером) |
| locked_price | NUMERIC(12,2) | Зафиксированная цена за штуку |
| locked_cost | NUMERIC(12,2) | Зафиксированная себестоимость |
| priority | BOOLEAN DEFAULT false | Приоритет для производства |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Enum `OrderItemStatus`:**
```
draft → confirmed → in_production → ready_for_shipment → shipped → completed → cancelled
```

**Relationships:**
- `order` → Order (back_populates="items")
- `configuration` → DoorConfiguration (lazy="selectin")
- `doors` → OrderDoor[] (cascade="all, delete-orphan", lazy="selectin")

**Unique constraint:** `(order_id, position_number)`

### 3.3 OrderDoor (НОВАЯ модель)

**Таблица**: `order_doors`

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | UUID PK | |
| order_item_id | UUID FK → order_items | CASCADE DELETE |
| internal_number | VARCHAR(20) UNIQUE | Глобально уникальный номер ("D-00001") |
| marking | VARCHAR(50) | Маркировка для строителей ("Д1-001"), заполняет МОП |
| floor | VARCHAR(50) | Этаж |
| building_block | VARCHAR(100) | Подъезд/блок |
| apartment_number | VARCHAR(50) | Квартира |
| location_description | VARCHAR(300) | Описание |
| status | door_status_enum | Статус двери |
| priority | BOOLEAN DEFAULT false | Приоритет |
| qr_code | VARCHAR(500) | QR-код |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |

**Enum `DoorStatus`:**
```
pending → in_production → ready_for_shipment → shipped → completed
```

### 3.4 Генерация internal_number

PostgreSQL SEQUENCE: `CREATE SEQUENCE door_internal_seq;`
Формат: `D-{LPAD(nextval, 5, '0')}` → "D-00001", "D-00002"...

---

## 4. Бизнес-логика

### 4.1 Workflow заказа

```python
ALLOWED_ORDER_TRANSITIONS = {
    draft:       [measurement, active, cancelled],
    measurement: [active, cancelled],
    active:      [completed, cancelled],
    completed:   [],
    cancelled:   [],
}
```

**draft/measurement → active:**
- Минимум 1 позиция
- Фиксация цен: `locked_price = config.price_estimate` для всех позиций
- Позиции draft → confirmed автоматически

**active → completed:**
- Все позиции `completed` или `cancelled`

**→ cancelled:**
- ЗАПРЕЩЕНО если хоть одна дверь (OrderDoor) in_production или далее
- При отмене: все pending позиции/двери → cancelled

### 4.2 Workflow позиции (OrderItem)

```python
ALLOWED_ITEM_TRANSITIONS = {
    draft:                [confirmed, cancelled],
    confirmed:            [in_production, cancelled],
    in_production:        [ready_for_shipment, cancelled],
    ready_for_shipment:   [shipped, cancelled],
    shipped:              [completed],
    completed:            [],
    cancelled:            [],
}
```

**draft → confirmed:** фиксация цены
**confirmed → in_production:** автосоздание OrderDoor записей (если не созданы)
**→ cancelled:** ЗАПРЕЩЕНО если есть двери in_production+

### 4.3 Workflow двери (OrderDoor)

```python
ALLOWED_DOOR_TRANSITIONS = {
    pending:              [in_production],
    in_production:        [ready_for_shipment],
    ready_for_shipment:   [shipped],
    shipped:              [completed],
    completed:            [],
}
```

Двери нельзя отменять после запуска в производство.
Двери pending можно удалить.

### 4.4 Расчёт стоимости

```
subtotal = SUM(item.locked_price * item.quantity) для не-cancelled позиций
discount = subtotal * discount_percent / 100
total_before_vat = subtotal - discount + замер + доставка + монтаж
vat = total_before_vat * 16%
TOTAL = total_before_vat + vat
outstanding = TOTAL - prepayment
```

### 4.5 Правила отмены

| Что отменяем | Когда можно | Когда НЕЛЬЗЯ |
|---|---|---|
| Заказ | Все двери pending/не созданы | Есть двери in_production+ |
| Позицию | Все двери pending | Есть двери in_production+ |
| Дверь | Только удалить pending | in_production и далее |

---

## 5. API эндпоинты

### 5.1 Заказ:
```
GET    /api/v1/orders                                   — список с пагинацией
POST   /api/v1/orders                                   — создать (+ items[])
GET    /api/v1/orders/{id}                              — получить (с items + doors)
PATCH  /api/v1/orders/{id}                              — обновить поля
DELETE /api/v1/orders/{id}                              — удалить (только draft)
PATCH  /api/v1/orders/{id}/status                       — workflow заказа
GET    /api/v1/orders/{id}/summary                      — финансовая сводка с НДС
```

### 5.2 Позиции:
```
POST   /api/v1/orders/{id}/items                        — добавить позицию
PATCH  /api/v1/orders/{id}/items/{item_id}              — обновить
DELETE /api/v1/orders/{id}/items/{item_id}              — удалить
PATCH  /api/v1/orders/{id}/items/{item_id}/status       — workflow позиции
```

### 5.3 Двери:
```
POST   /api/v1/orders/{id}/items/{item_id}/doors/generate  — генерация пакетом
PATCH  /api/v1/orders/{id}/doors/{door_id}                 — обновить маркировку
PATCH  /api/v1/orders/{id}/doors/{door_id}/status          — workflow двери
PATCH  /api/v1/orders/{id}/doors/batch-status              — массовый перевод
PATCH  /api/v1/orders/{id}/doors/{door_id}/priority        — приоритет
DELETE /api/v1/orders/{id}/doors/{door_id}                 — удалить (pending)
```

---

## 6. Pydantic схемы

### OrderDoorSchema:
```python
id, order_item_id, internal_number, marking
floor, building_block, apartment_number, location_description
status (DoorStatus), priority, qr_code, notes, created_at
```

### OrderItemSchema:
```python
id, order_id, configuration_id, position_number, quantity
status (OrderItemStatus), locked_price, locked_cost, priority
notes, created_at, updated_at
configuration_name, door_type
price_per_unit, total_price
doors_count, doors: list[OrderDoorSchema]
doors_pending, doors_in_production, doors_ready, doors_shipped, doors_completed
```

### OrderSchema:
```python
# Все текущие поля +
items: list[OrderItemSchema]  # ВМЕСТО configurations
```

---

## 7. Frontend — Brand Rebrand

### Цвета (из staleks.kz):
- Акцент: `#C0DF16` (лайм) — кнопки, активные ссылки, бейджи
- Сайдбар: `#212322` (тёмный)
- Hover сайдбара: `#2d2e2d`
- Фон страниц: `#FAF9F5` (тёплый белый)
- Muted текст: `#969C99`
- Ошибки: `#DF1616`
- Шрифт: **Montserrat** (Google Fonts)

### Файлы для ребранда:
- `tailwind.config.ts` — кастомные цвета `staleks.*`, шрифт
- `app/layout.tsx` — импорт Montserrat через `next/font/google`
- `components/layout/Sidebar.tsx` — `bg-staleks-dark`, `bg-staleks-accent`
- `app/(dashboard)/layout.tsx` — `bg-staleks-bg`
- `app/(auth)/login/page.tsx` — ребранд кнопки и логотипа
- `app/(dashboard)/orders/page.tsx` — все `orange-*` → `staleks-accent`

---

## 8. Файлы для изменения

### Backend (5 файлов):
| # | Файл | Действие |
|---|------|----------|
| 1 | `backend/alembic/versions/0005_order_items.py` | ПЕРЕПИСАТЬ |
| 2 | `backend/app/orders/models.py` | ПЕРЕПИСАТЬ |
| 3 | `backend/app/orders/schemas.py` | ПЕРЕПИСАТЬ |
| 4 | `backend/app/orders/service.py` | ПЕРЕПИСАТЬ |
| 5 | `backend/app/orders/router.py` | ПЕРЕПИСАТЬ |

### Frontend (10 файлов):
| # | Файл | Действие |
|---|------|----------|
| 6 | `frontend/tailwind.config.ts` | ИЗМЕНИТЬ |
| 7 | `frontend/src/app/layout.tsx` | ИЗМЕНИТЬ |
| 8 | `frontend/src/app/(dashboard)/layout.tsx` | ИЗМЕНИТЬ |
| 9 | `frontend/src/app/(auth)/login/page.tsx` | ИЗМЕНИТЬ |
| 10 | `frontend/src/components/layout/Sidebar.tsx` | ИЗМЕНИТЬ |
| 11 | `frontend/src/types/orders.ts` | ПЕРЕПИСАТЬ |
| 12 | `frontend/src/lib/ordersApi.ts` | ПЕРЕПИСАТЬ |
| 13 | `frontend/src/app/(dashboard)/orders/page.tsx` | ПЕРЕПИСАТЬ |
| 14 | `frontend/src/app/(dashboard)/dashboard/page.tsx` | ИЗМЕНИТЬ |
| 15 | `frontend/src/app/(auth)/layout.tsx` | ИЗМЕНИТЬ |

---

## 9. Порядок реализации

1. Миграция 0005 (order_items + order_doors + sequence + data migration)
2. Backend models (OrderItem, OrderDoor, обновлённый Order)
3. Backend schemas (все Pydantic схемы)
4. Backend service (бизнес-логика, workflow, batch)
5. Backend router (все endpoints)
6. Frontend brand (Tailwind, Montserrat, Sidebar, все страницы)
7. Frontend types + API (TypeScript, ordersApi.ts)
8. Frontend orders page (позиции, двери, прогресс, batch)
9. Миграция + тесты
10. Визуальная верификация

---

## 10. Верификация

1. `make migrate` — миграция 0005 без ошибок
2. Создать заказ → добавить позицию → сгенерировать двери → активировать
3. Перевести позицию in_production → автосоздание дверей
4. Двигать отдельные двери по статусам
5. Попытка отменить заказ с дверями in_production → ошибка
6. Batch-перевод статуса 50 дверей
7. МОП заполняет маркировку, этаж, квартиру вручную
8. Frontend: Montserrat + лайм + тёмный сайдбар
9. Frontend: таблица дверей внутри позиции с фильтрами
