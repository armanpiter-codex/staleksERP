# Staleks ERP — Техническое задание v2.0

## Context

Проанализирована Odoo Community Edition (staleksodoo.kz) — заказ SO21430, ~80 дверей, ЖК "Нео Парк", 14.9M тг.
**Цель**: взять лучшее из Odoo (замерщик, audit log, маркировки), выкинуть плохое (9260 вариантов-мусора, ручные цены, текстовая каша), построить структурированную систему в Staleks ERP.

**Бизнес-параметры**: НДС 16% (Казахстан 2026), валюта KZT, ТОО «AlCom Engineering Group», 3 цеха, каналы B2B/B2C.

---

## Спринт 1 — Backend: модель заказа + замерщики + дубликат

### 1.1 Миграция `0004_orders_enhancement.py`

Паттерн: raw SQL DDL через `op.execute(sa.text(...))` (как 0002/0003).

**Новый enum:**
```sql
DO $$ BEGIN
  CREATE TYPE sales_channel_enum AS ENUM ('corporate', 'dealer', 'retail');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

**Новый статус `measurement`** — добавить в существующий enum:
```sql
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'measurement' BEFORE 'confirmed';
```

**Новые колонки на `orders`:**
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS measurer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS measurement_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS object_name VARCHAR(300);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_channel sales_channel_enum;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 16;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS installation_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(100);
```

**Новые колонки на `door_configurations`** (для фиксации цен, Блок 7):
```sql
ALTER TABLE door_configurations ADD COLUMN IF NOT EXISTS locked_price NUMERIC(12,2);
ALTER TABLE door_configurations ADD COLUMN IF NOT EXISTS locked_cost NUMERIC(12,2);
```

**Новые колонки на `door_markings`** (для расширения маркировок, Блок 6):
```sql
ALTER TABLE door_markings ADD COLUMN IF NOT EXISTS building_block VARCHAR(100);
ALTER TABLE door_markings ADD COLUMN IF NOT EXISTS apartment_number VARCHAR(50);
```

**Индексы:**
```sql
CREATE INDEX IF NOT EXISTS idx_orders_measurer_id ON orders(measurer_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales_channel ON orders(sales_channel);
CREATE INDEX IF NOT EXISTS idx_orders_object_name ON orders(object_name);
```

**Файл**: `backend/alembic/versions/0004_orders_enhancement.py`

---

### 1.2 Обновление модели Order

Добавить в `backend/app/orders/models.py`:

**Новый enum class:**
```python
class SalesChannel(str, enum.Enum):
    corporate = "corporate"
    dealer = "dealer"
    retail = "retail"
```

**Новое значение в OrderStatus:**
```python
class OrderStatus(str, enum.Enum):
    draft = "draft"
    measurement = "measurement"      # ← НОВЫЙ
    confirmed = "confirmed"
    in_production = "in_production"
    shipped = "shipped"
    completed = "completed"
    cancelled = "cancelled"
```

**Новые поля на Order:**
```python
# Замерщик (из Odoo)
measurer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
measurement_cost = Column(Numeric(12, 2), default=0, server_default="0")

# B2B объект (из Odoo: "ЖК Нео Парк")
object_name = Column(String(300), nullable=True)

# Канал продаж
sales_channel = Column(SAEnum(SalesChannel, name="sales_channel_enum", create_type=False), nullable=True)

# НДС
vat_rate = Column(Numeric(5, 2), default=16, server_default="16")

# Доп. услуги
delivery_cost = Column(Numeric(12, 2), default=0, server_default="0")
installation_cost = Column(Numeric(12, 2), default=0, server_default="0")

# Timestamps статусов
confirmed_at = Column(DateTime(timezone=True), nullable=True)
production_started_at = Column(DateTime(timezone=True), nullable=True)
shipped_at = Column(DateTime(timezone=True), nullable=True)
completed_at = Column(DateTime(timezone=True), nullable=True)

# Источник заявки
source = Column(String(100), nullable=True)

# Relationship
measurer = relationship("User", foreign_keys=[measurer_id], lazy="selectin")
```

---

### 1.3 Обновление Pydantic-схем

**Файл**: `backend/app/orders/schemas.py`

Добавить в `OrderCreateSchema`:
```python
measurer_id: uuid.UUID | None = None
measurement_cost: Decimal | None = Field(None, ge=0)
object_name: str | None = Field(None, max_length=300)
sales_channel: SalesChannel | None = None
vat_rate: Decimal = Field(default=Decimal("16"), ge=0, le=100)
delivery_cost: Decimal | None = Field(None, ge=0)
installation_cost: Decimal | None = Field(None, ge=0)
source: str | None = Field(None, max_length=100)
```

Добавить в `OrderUpdateSchema` — те же поля как Optional.

Добавить в `OrderSchema`:
```python
measurer_id: uuid.UUID | None = None
measurement_cost: Decimal | None = None
object_name: str | None = None
sales_channel: SalesChannel | None = None
vat_rate: Decimal | None = None
delivery_cost: Decimal | None = None
installation_cost: Decimal | None = None
confirmed_at: datetime | None = None
production_started_at: datetime | None = None
shipped_at: datetime | None = None
completed_at: datetime | None = None
source: str | None = None
```

Расширить `OrderSummarySchema` (НДС-расчёт):
```python
class OrderSummarySchema(BaseModel):
    order_id: uuid.UUID
    order_number: str
    client_name: str
    client_type: ClientType
    status: OrderStatus
    configurations_count: int
    total_doors: int

    # Расшифровка стоимости
    subtotal: Decimal              # сумма конфигураций (locked_price ?? price_estimate) * qty
    discount_amount: Decimal       # скидка
    measurement_cost: Decimal      # стоимость замера
    delivery_cost: Decimal         # доставка
    installation_cost: Decimal     # монтаж
    total_before_vat: Decimal      # subtotal - discount + замер + доставка + монтаж
    vat_rate: Decimal              # ставка (16)
    vat_amount: Decimal            # НДС
    total_with_vat: Decimal        # ИТОГО

    prepayment_amount: Decimal | None
    outstanding_amount: Decimal | None   # total_with_vat - prepayment

    configurations: list[ConfigurationSummarySchema]
```

---

### 1.4 Селектор замерщиков (Блок 9)

**Файл**: `backend/app/users/service.py` — новая функция:
```python
async def get_users_by_role(db: AsyncSession, role_code: str) -> list[User]:
    """Получить пользователей по роли. Для выпадающего списка замерщиков."""
    result = await db.execute(
        select(User)
        .join(User.roles)
        .where(Role.code == role_code, User.is_active == True)
        .order_by(User.full_name)
    )
    return result.scalars().all()
```

**Файл**: `backend/app/users/router.py` — новый endpoint:
```
GET /api/v1/users/by-role?role={role_code}
Permission: любой авторизованный пользователь
Response: list[UserBriefSchema]  # id, full_name, username
```

**Новая схема** `UserBriefSchema`:
```python
class UserBriefSchema(BaseModel):
    id: uuid.UUID
    full_name: str
    username: str
    model_config = ConfigDict(from_attributes=True)
```

---

### 1.5 Дублирование конфигурации (Блок 5)

**Файл**: `backend/app/configurator/service.py` — новая функция:
```python
async def duplicate_configuration(
    db: AsyncSession,
    config_id: uuid.UUID,
    created_by: uuid.UUID
) -> DoorConfiguration:
    """Копия конфигурации: сброс статуса=draft, order_id=None, новое имя."""
    original = await get_configuration(db, config_id)
    new_config = DoorConfiguration(
        door_type=original.door_type,
        name=f"{original.name} (копия)",
        quantity=original.quantity,
        values=dict(original.values),  # deep copy JSONB
        price_estimate=original.price_estimate,
        cost_price=original.cost_price,
        status=ConfigurationStatus.draft,
        order_id=None,  # не привязана
        notes=original.notes,
        created_by=created_by,
    )
    db.add(new_config)
    await db.flush()
    return new_config
```

**Файл**: `backend/app/configurator/router.py` — новый endpoint:
```
POST /api/v1/configurator/configurations/{config_id}/duplicate
Permission: configurator:create
Response: ConfigurationSchema (201)
```

---

## Спринт 2 — Backend: workflow + НДС + фиксация цен + маркировки

### 2.1 Workflow статусов (Блок 2)

**Файл**: `backend/app/orders/service.py` — новая функция:

```python
# Допустимые переходы
ALLOWED_TRANSITIONS = {
    OrderStatus.draft: [OrderStatus.measurement, OrderStatus.confirmed, OrderStatus.cancelled],
    OrderStatus.measurement: [OrderStatus.confirmed, OrderStatus.cancelled],
    OrderStatus.confirmed: [OrderStatus.in_production, OrderStatus.cancelled],
    OrderStatus.in_production: [OrderStatus.shipped, OrderStatus.cancelled],
    OrderStatus.shipped: [OrderStatus.completed],
    OrderStatus.completed: [],
    OrderStatus.cancelled: [],
}

# Timestamp-поля для авто-заполнения
STATUS_TIMESTAMPS = {
    OrderStatus.confirmed: "confirmed_at",
    OrderStatus.in_production: "production_started_at",
    OrderStatus.shipped: "shipped_at",
    OrderStatus.completed: "completed_at",
}

async def transition_order_status(
    db: AsyncSession,
    order_id: uuid.UUID,
    new_status: OrderStatus,
) -> Order:
    order = await get_order(db, order_id)

    if new_status not in ALLOWED_TRANSITIONS[order.status]:
        raise BadRequestException(
            f"Нельзя перейти из '{order.status.value}' в '{new_status.value}'"
        )

    # Валидация: в production только если есть конфигурации
    if new_status == OrderStatus.in_production:
        if not order.configurations:
            raise BadRequestException("Нельзя запустить в производство без конфигураций")

    # Фиксация цен при подтверждении (Блок 7)
    if new_status == OrderStatus.confirmed:
        for config in order.configurations:
            if config.locked_price is None:
                config.locked_price = config.price_estimate
                config.locked_cost = config.cost_price

    # Каскад: заказ → in_production → конфигурации → in_production
    if new_status == OrderStatus.in_production:
        for config in order.configurations:
            if config.status == ConfigurationStatus.confirmed:
                config.status = ConfigurationStatus.in_production

    order.status = new_status

    # Авто-заполнение timestamp
    ts_field = STATUS_TIMESTAMPS.get(new_status)
    if ts_field:
        setattr(order, ts_field, datetime.now(timezone.utc))

    await db.flush()
    return order
```

**Новый endpoint:**
```
PATCH /api/v1/orders/{order_id}/status
Body: { "status": "confirmed" }
Permission: orders:write
Response: OrderSchema
```

---

### 2.2 Расчёт НДС (Блок 4)

**Файл**: `backend/app/orders/service.py` — переработка `get_order_summary`:

```python
async def get_order_summary(db: AsyncSession, order_id: uuid.UUID) -> OrderSummarySchema:
    order = await get_order(db, order_id)

    configs = order.configurations or []
    configurations_count = len(configs)
    total_doors = sum(c.quantity for c in configs)

    # Считаем из locked_price (если есть) или price_estimate
    subtotal = Decimal("0")
    config_summaries = []
    for c in configs:
        price = c.locked_price if c.locked_price is not None else (c.price_estimate or Decimal("0"))
        subtotal += price * c.quantity
        config_summaries.append(ConfigurationSummarySchema.model_validate(c))

    # Скидка
    discount_amount = Decimal("0")
    if order.discount_percent:
        discount_amount = subtotal * order.discount_percent / Decimal("100")

    # Доп. услуги
    measurement = order.measurement_cost or Decimal("0")
    delivery = order.delivery_cost or Decimal("0")
    installation = order.installation_cost or Decimal("0")

    # Итого без НДС
    total_before_vat = subtotal - discount_amount + measurement + delivery + installation

    # НДС
    vat_rate = order.vat_rate or Decimal("16")
    vat_amount = total_before_vat * vat_rate / Decimal("100")

    # ИТОГО
    total_with_vat = total_before_vat + vat_amount

    # Остаток к оплате
    prepayment = order.prepayment_amount
    outstanding = total_with_vat - prepayment if prepayment else None

    return OrderSummarySchema(
        order_id=order.id,
        order_number=order.order_number,
        client_name=order.client_name,
        client_type=order.client_type,
        status=order.status,
        configurations_count=configurations_count,
        total_doors=total_doors,
        subtotal=subtotal,
        discount_amount=discount_amount,
        measurement_cost=measurement,
        delivery_cost=delivery,
        installation_cost=installation,
        total_before_vat=total_before_vat,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_with_vat=total_with_vat,
        prepayment_amount=prepayment,
        outstanding_amount=outstanding,
        configurations=config_summaries,
    )
```

Также обновить `_recalculate_total` — пересчитывать `order.total_price = total_with_vat`.

---

### 2.3 Фиксация цен (Блок 7)

Логика встроена в `transition_order_status` (Блок 2.1 выше).

**Изменения в модели** `DoorConfiguration` (`backend/app/configurator/models.py`):
```python
locked_price = Column(Numeric(12, 2), nullable=True)  # зафиксированная цена при confirmed
locked_cost = Column(Numeric(12, 2), nullable=True)    # зафиксированная себестоимость
```

**Изменения в сервисе заказов** — `_recalculate_total` использует `locked_price` если есть:
```python
price = config.locked_price if config.locked_price is not None else (config.price_estimate or 0)
```

---

### 2.4 Маркировки — расширение (Блок 6)

**Модель** `DoorMarking` — новые поля (колонки добавлены в миграции 0004):
```python
building_block = Column(String(100), nullable=True)     # подъезд/блок ("Пятно 1")
apartment_number = Column(String(50), nullable=True)     # номер квартиры
```

**Новый endpoint** на orders router:
```
GET /api/v1/orders/{order_id}/markings
Permission: orders:read
Response: OrderMarkingsSchema
```

**Новая схема:**
```python
class OrderMarkingItemSchema(BaseModel):
    id: uuid.UUID
    marking: str
    floor: str | None
    building_block: str | None
    apartment_number: str | None
    location_description: str | None
    status: MarkingStatus
    configuration_name: str       # из parent config
    door_type: str                # из parent config

class OrderMarkingsSchema(BaseModel):
    order_id: uuid.UUID
    total_markings: int
    markings: list[OrderMarkingItemSchema]
```

**Сервис** `backend/app/orders/service.py`:
```python
async def get_order_markings(db: AsyncSession, order_id: uuid.UUID) -> OrderMarkingsSchema:
    order = await get_order(db, order_id)
    markings = []
    for config in order.configurations:
        for m in config.markings:
            markings.append(OrderMarkingItemSchema(
                id=m.id, marking=m.marking, floor=m.floor,
                building_block=m.building_block,
                apartment_number=m.apartment_number,
                location_description=m.location_description,
                status=m.status,
                configuration_name=config.name,
                door_type=config.door_type.value,
            ))
    return OrderMarkingsSchema(
        order_id=order.id,
        total_markings=len(markings),
        markings=sorted(markings, key=lambda m: (m.building_block or "", m.floor or "", m.marking)),
    )
```

---

## Спринт 3 — Frontend: полная переработка страницы заказов

### 3.1 Декомпозиция `orders/page.tsx` (836 строк → 5 компонентов)

**Текущие проблемы:**
- Монолит с 12+ useState
- Валюта `rub()` вместо `kzt()`
- Нет новых полей (замерщик, НДС, канал, объект)
- Нет инлайн-создания конфигурации

**Новая структура:**

```
frontend/src/
├── app/(dashboard)/orders/page.tsx          # Router: list|create|edit
├── components/orders/
│   ├── OrderListView.tsx                    # Таблица + фильтры
│   ├── OrderCreateForm.tsx                  # Форма создания
│   ├── OrderEditView.tsx                    # Редактирование + панели
│   ├── OrderFinancialSummary.tsx            # НДС-расчёт, итоги
│   ├── OrderMarkingsView.tsx                # Сводка маркировок
│   └── OrderStatusWorkflow.tsx              # Кнопки переходов
├── lib/ordersApi.ts                         # + новые endpoints
├── types/orders.ts                          # + новые типы
└── lib/utils.ts                             # kzt() вместо rub()
```

### 3.2 `OrderListView` — таблица с фильтрами

**Колонки:** №, Клиент, Канал, Объект, Статус, Двери (кол-во), Итого (с НДС), Дата, Менеджер.
**Фильтры:** статус (dropdown), канал (corporate/dealer/retail), поиск (по клиенту/объекту).
**Действия:** клик по строке → edit; кнопка "Создать заказ".

### 3.3 `OrderCreateForm`

**Поля:**
- Канал продаж (corporate/dealer/retail) — radio group
- Клиент: имя*, телефон, email
- Компания (только B2B/dealer)
- Объект (только corporate): "ЖК Нео Парк"
- Замерщик (dropdown из `/users/by-role?role=measurer`)
- Стоимость замера
- Источник заявки
- Адрес доставки
- Желаемая дата
- Примечания

### 3.4 `OrderEditView`

**Секции:**
1. Шапка: номер, статус-бейдж, workflow-кнопки
2. Клиент: карточка с данными
3. Конфигурации: таблица + "Добавить" + "Дублировать" + "Удалить"
4. Маркировки: сводка (из `/orders/{id}/markings`)
5. Финансы: `OrderFinancialSummary`
6. Доп. услуги: замер, доставка, монтаж (editablefields)

### 3.5 `OrderFinancialSummary`

**Отображает:**
```
Конфигурации (5 шт, 80 дверей):    13,293,750 ₸
Скидка (5%):                         - 664,688 ₸
Стоимость замера:                       50,000 ₸
Доставка:                              200,000 ₸
Монтаж:                                500,000 ₸
─────────────────────────────────────────────────
Итого без НДС:                      13,379,062 ₸
НДС (16%):                           2,140,650 ₸
═════════════════════════════════════════════════
ИТОГО:                               15,519,712 ₸
Предоплата:                          -7,000,000 ₸
Остаток:                              8,519,712 ₸
```

### 3.6 Исправление валюты

В `frontend/src/lib/utils.ts` (или где сейчас `rub()`):
```typescript
export function kzt(amount: number | string | null): string {
  if (amount === null || amount === undefined) return "0 ₸";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ru-KZ", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num) + " ₸";
}
```

Заменить все вызовы `rub()` → `kzt()` в проекте.

### 3.7 Обновление TypeScript-типов

**`frontend/src/types/orders.ts`** — добавить:
```typescript
type SalesChannel = "corporate" | "dealer" | "retail";

interface Order {
  // ... existing fields ...
  measurer_id: string | null;
  measurement_cost: string | null;
  object_name: string | null;
  sales_channel: SalesChannel | null;
  vat_rate: string | null;
  delivery_cost: string | null;
  installation_cost: string | null;
  confirmed_at: string | null;
  production_started_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  source: string | null;
}

// Обновить ORDER_STATUS_LABELS
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Черновик",
  measurement: "Замер",        // ← НОВЫЙ
  confirmed: "Подтверждён",
  in_production: "В производстве",
  shipped: "Отгружен",
  completed: "Завершён",
  cancelled: "Отменён",
};

// Обновить переходы
const ORDER_STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  draft: "measurement",           // draft → measurement (вместо confirmed)
  measurement: "confirmed",
  confirmed: "in_production",
  in_production: "shipped",
  shipped: "completed",
  completed: null,
  cancelled: null,
};
```

### 3.8 Обновление ordersApi.ts

Добавить:
```typescript
transitionStatus(orderId: string, status: OrderStatus): Promise<Order>
// PATCH /api/v1/orders/{orderId}/status  body: { status }

getOrderMarkings(orderId: string): Promise<OrderMarkings>
// GET /api/v1/orders/{orderId}/markings

getUsersByRole(role: string): Promise<UserBrief[]>
// GET /api/v1/users/by-role?role={role}

duplicateConfiguration(configId: string): Promise<Configuration>
// POST /api/v1/configurator/configurations/{configId}/duplicate
```

---

## Спринт 4 — Audit Log + КП PDF

### 4.1 Audit Log (Блок 8)

**Миграция `0005_audit_log.py`:**
```sql
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,       -- 'order', 'configuration', 'marking'
    entity_id UUID NOT NULL,
    action VARCHAR(30) NOT NULL,            -- 'create', 'update', 'status_change', 'attach', 'detach'
    field_name VARCHAR(100),                -- NULL для action='create'
    old_value TEXT,
    new_value TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
```

**Новый модуль** `backend/app/common/audit.py`:
```python
async def log_change(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    user_id: uuid.UUID,
    field_name: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        user_id=user_id,
    )
    db.add(entry)

async def log_entity_changes(
    db: AsyncSession,
    entity_type: str,
    entity_id: uuid.UUID,
    user_id: uuid.UUID,
    old_data: dict,
    new_data: dict,
) -> None:
    """Сравнить два dict и записать все изменившиеся поля."""
    for key in new_data:
        if key in old_data and old_data[key] != new_data[key]:
            await log_change(db, entity_type, entity_id, "update", user_id,
                           field_name=key, old_value=str(old_data[key]), new_value=str(new_data[key]))
```

**Интеграция**: вызывать `log_change()`/`log_entity_changes()` в:
- `orders/service.py` → create_order, update_order, transition_status, attach/detach config
- `configurator/service.py` → create/update configuration

**API endpoint:**
```
GET /api/v1/orders/{order_id}/audit?limit=50&offset=0
Permission: orders:read
Response: PaginatedAuditLogSchema
```

**Frontend**: `OrderAuditLog.tsx` — таймлайн (как Chatter в Odoo):
```
[12:45] Куанбеков Рифхат — Создал заказ B2B-2026-0043
[12:46] Куанбеков Рифхат — Добавил конфигурацию "Д-1 ДМП"
[12:47] Куанбеков Рифхат — Изменил статус: Черновик → Замер
[13:10] Менеджер — Изменил стоимость замера: 0 → 50,000
```

---

### 4.2 КП PDF генерация (Блок 10)

**Новый модуль** `backend/app/kp/`:
```
backend/app/kp/
├── __init__.py
├── models.py       # KPDocument
├── schemas.py      # KPCreateSchema, KPSchema
├── service.py      # generate_kp, get_kp
├── router.py       # POST/GET endpoints
└── templates/
    └── kp_template.html   # Jinja2 + WeasyPrint
```

**Модель KPDocument** (миграция в 0005 или отдельная 0006):
```sql
CREATE TABLE IF NOT EXISTS kp_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    file_path VARCHAR(500) NOT NULL,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_terms TEXT,
    validity_days INTEGER DEFAULT 30,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kp_order_id ON kp_documents(order_id);
```

**Генерация PDF:**
- Библиотека: WeasyPrint (добавить в requirements.txt)
- Шаблон: Jinja2 HTML → PDF
- Содержимое: шапка компании (AlCom), таблица дверей, маркировки, финансовая сводка с НДС, условия оплаты

**Endpoints:**
```
POST /api/v1/orders/{order_id}/kp
Permission: kp:generate
Body: { payment_terms?: string, validity_days?: int, notes?: string }
Response: KPSchema (201)

GET /api/v1/orders/{order_id}/kp
Permission: kp:view_all
Response: list[KPSchema]   # все версии КП для заказа

GET /api/v1/kp/{kp_id}/download
Permission: kp:view_all
Response: PDF file (application/pdf)
```

---

## Сводка изменяемых файлов

| Спринт | Файл | Действие |
|--------|------|----------|
| 1 | `alembic/versions/0004_orders_enhancement.py` | СОЗДАТЬ |
| 1 | `backend/app/orders/models.py` | ИЗМЕНИТЬ (enum + поля) |
| 1 | `backend/app/orders/schemas.py` | ИЗМЕНИТЬ (все схемы) |
| 1 | `backend/app/orders/service.py` | ИЗМЕНИТЬ (summary, recalculate) |
| 1 | `backend/app/users/service.py` | ИЗМЕНИТЬ (get_users_by_role) |
| 1 | `backend/app/users/router.py` | ИЗМЕНИТЬ (by-role endpoint) |
| 1 | `backend/app/users/schemas.py` | ИЗМЕНИТЬ (UserBriefSchema) |
| 1 | `backend/app/configurator/service.py` | ИЗМЕНИТЬ (duplicate) |
| 1 | `backend/app/configurator/router.py` | ИЗМЕНИТЬ (duplicate endpoint) |
| 2 | `backend/app/orders/service.py` | ИЗМЕНИТЬ (workflow, VAT, markings) |
| 2 | `backend/app/orders/router.py` | ИЗМЕНИТЬ (status + markings endpoints) |
| 2 | `backend/app/configurator/models.py` | ИЗМЕНИТЬ (locked_price, building_block) |
| 3 | `frontend/src/app/(dashboard)/orders/page.tsx` | РЕФАКТОРИНГ |
| 3 | `frontend/src/components/orders/*.tsx` | СОЗДАТЬ (6 компонентов) |
| 3 | `frontend/src/types/orders.ts` | ИЗМЕНИТЬ |
| 3 | `frontend/src/lib/ordersApi.ts` | ИЗМЕНИТЬ |
| 3 | `frontend/src/lib/utils.ts` | ИЗМЕНИТЬ (rub→kzt) |
| 4 | `alembic/versions/0005_audit_log.py` | СОЗДАТЬ |
| 4 | `backend/app/common/audit.py` | СОЗДАТЬ |
| 4 | `backend/app/kp/` | СОЗДАТЬ (модуль) |

---

## Верификация

### После каждого спринта:
1. `make migrate` — миграция без ошибок
2. `make seed` — seed без ошибок (idempotent)
3. Backend запускается: `docker compose logs backend` — нет ошибок
4. API тест через curl/httpie:
   - Спринт 1: создать заказ с новыми полями, дублировать конфигурацию, получить замерщиков
   - Спринт 2: перевести заказ по статусам, проверить фиксацию цен, получить маркировки
   - Спринт 3: frontend загружается, создание/редактирование заказа работает, валюта KZT
   - Спринт 4: сгенерировать КП PDF, проверить audit log
5. Frontend запускается: `docker compose logs frontend` — нет ошибок
