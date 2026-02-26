import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.orders.models import (
    ClientType, DoorStatus, OrderItemStatus, OrderStatus, PaymentStatus, SalesChannel,
)
from app.services.models import BillingMethod


# ─── Facility schemas ─────────────────────────────────────────────────────────

class FacilitySchema(BaseModel):
    id: uuid.UUID
    name: str
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FacilityCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)


class FacilityUpdateSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=300)
    is_active: bool | None = None


# ─── OrderDoor schemas ───────────────────────────────────────────────────────

class OrderDoorSchema(BaseModel):
    id: uuid.UUID
    order_item_id: uuid.UUID
    internal_number: str
    marking: str | None
    floor: str | None
    building_block: str | None
    apartment_number: str | None
    location_description: str | None
    status: DoorStatus
    priority: bool
    qr_code: str | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderDoorUpdateSchema(BaseModel):
    marking: str | None = Field(None, max_length=50)
    floor: str | None = Field(None, max_length=50)
    building_block: str | None = Field(None, max_length=100)
    apartment_number: str | None = Field(None, max_length=50)
    location_description: str | None = Field(None, max_length=300)
    notes: str | None = None


class DoorStatusTransitionSchema(BaseModel):
    status: DoorStatus


class BatchDoorStatusSchema(BaseModel):
    door_ids: list[uuid.UUID]
    status: DoorStatus


class GenerateDoorsSchema(BaseModel):
    marking_prefix: str | None = Field(None, min_length=1, max_length=20)
    start_number: int = Field(default=1, ge=1)
    count: int | None = None  # если None — по quantity позиции
    floor: str | None = Field(None, max_length=50)
    building_block: str | None = Field(None, max_length=100)
    apartment_number: str | None = Field(None, max_length=50)


# ─── OrderItem schemas ───────────────────────────────────────────────────────

class OrderItemCreateSchema(BaseModel):
    configuration_id: uuid.UUID
    quantity: int = Field(ge=1, default=1)
    variant_values: dict | None = None
    priority: bool = False
    notes: str | None = None


class OrderItemUpdateSchema(BaseModel):
    quantity: int | None = Field(None, ge=1)
    variant_values: dict | None = None
    priority: bool | None = None
    notes: str | None = None


class ItemStatusTransitionSchema(BaseModel):
    status: OrderItemStatus


class OrderItemSchema(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    configuration_id: uuid.UUID
    position_number: int
    quantity: int
    status: OrderItemStatus
    locked_price: Decimal | None
    locked_cost: Decimal | None
    variant_values: dict = {}
    variant_price: Decimal = Decimal("0")
    variant_cost: Decimal = Decimal("0")
    priority: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime

    # Вычисляемые поля
    configuration_name: str
    door_type: str
    price_per_unit: Decimal | None
    total_price: Decimal | None

    # Двери
    doors_count: int
    doors: list[OrderDoorSchema] = []

    # Прогресс по статусам дверей
    doors_pending: int = 0
    doors_in_production: int = 0
    doors_ready: int = 0
    doors_shipped: int = 0
    doors_completed: int = 0

    model_config = ConfigDict(from_attributes=True)


# ─── Order schemas ───────────────────────────────────────────────────────────

class OrderSchema(BaseModel):
    id: uuid.UUID
    order_number: str
    client_name: str
    client_phone: str | None
    client_email: str | None
    client_type: ClientType
    client_company: str | None
    status: OrderStatus
    total_price: Decimal | None
    prepayment_amount: Decimal | None
    discount_percent: Decimal | None
    payment_status: PaymentStatus
    credit_days: int | None
    notes: str | None
    delivery_address: str | None
    desired_delivery_date: datetime | None
    manager_id: uuid.UUID

    # Sprint 1 fields
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

    # Facility (объект строительства)
    facility_id: uuid.UUID | None = None
    facility_name: str | None = None  # вычисляется в роутере из relationship

    created_at: datetime
    updated_at: datetime

    # Sprint 2: позиции заказа
    items: list[OrderItemSchema] = []

    # Sprint 8: имя менеджера (вычисляется в роутере)
    manager_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OrderCreateSchema(BaseModel):
    client_name: str = Field(..., min_length=1, max_length=200)
    client_phone: str | None = Field(None, max_length=30)
    client_email: str | None = Field(None, max_length=255)
    client_type: ClientType
    client_company: str | None = Field(None, max_length=200)
    notes: str | None = None
    delivery_address: str | None = None
    desired_delivery_date: datetime | None = None
    prepayment_amount: Decimal | None = Field(None, ge=0)
    discount_percent: Decimal | None = Field(None, ge=0, le=100)
    credit_days: int | None = Field(None, ge=0, le=365)

    # Sprint 1 fields
    measurer_id: uuid.UUID | None = None
    measurement_cost: Decimal | None = Field(None, ge=0)
    object_name: str | None = Field(None, max_length=300)
    sales_channel: SalesChannel | None = None
    vat_rate: Decimal = Field(default=Decimal("16"), ge=0, le=100)
    delivery_cost: Decimal | None = Field(None, ge=0)
    installation_cost: Decimal | None = Field(None, ge=0)
    source: str | None = Field(None, max_length=100)

    # Facility
    facility_id: uuid.UUID | None = None

    # Sprint 2: позиции при создании
    items: list[OrderItemCreateSchema] = Field(default_factory=list)
    # Legacy support
    configuration_ids: list[uuid.UUID] = Field(default_factory=list)


class OrderUpdateSchema(BaseModel):
    client_name: str | None = Field(None, min_length=1, max_length=200)
    client_phone: str | None = None
    client_email: str | None = None
    client_company: str | None = None
    status: OrderStatus | None = None
    payment_status: PaymentStatus | None = None
    prepayment_amount: Decimal | None = Field(None, ge=0)
    discount_percent: Decimal | None = Field(None, ge=0, le=100)
    credit_days: int | None = Field(None, ge=0, le=365)
    notes: str | None = None
    delivery_address: str | None = None
    desired_delivery_date: datetime | None = None

    # Sprint 1 fields
    measurer_id: uuid.UUID | None = None
    measurement_cost: Decimal | None = Field(None, ge=0)
    object_name: str | None = Field(None, max_length=300)
    sales_channel: SalesChannel | None = None
    vat_rate: Decimal | None = Field(None, ge=0, le=100)
    delivery_cost: Decimal | None = Field(None, ge=0)
    installation_cost: Decimal | None = Field(None, ge=0)
    source: str | None = Field(None, max_length=100)

    # Facility
    facility_id: uuid.UUID | None = None


# ─── Status transition ──────────────────────────────────────────────────────

class StatusTransitionSchema(BaseModel):
    status: OrderStatus


# ─── Order Service schemas ──────────────────────────────────────────────────

class OrderServiceSchema(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    service_type_id: uuid.UUID
    service_type_code: str
    service_type_name: str
    service_type_icon: str | None
    price: Decimal
    billing_method: BillingMethod
    billing_entity_name: str | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderServiceCreateSchema(BaseModel):
    service_type_id: uuid.UUID
    price: Decimal = Field(default=Decimal("0"), ge=0)
    billing_method: BillingMethod | None = None  # если None — берётся из service_type
    billing_entity_name: str | None = Field(None, max_length=300)
    notes: str | None = None


class OrderServiceUpdateSchema(BaseModel):
    price: Decimal | None = Field(None, ge=0)
    billing_method: BillingMethod | None = None
    billing_entity_name: str | None = Field(None, max_length=300)
    notes: str | None = None


# ─── Order Summary ───────────────────────────────────────────────────────────

class ServiceLineSchema(BaseModel):
    service_type_code: str
    service_type_name: str
    icon: str | None
    price: Decimal
    billing_method: BillingMethod
    billing_entity_name: str | None


class ItemSummarySchema(BaseModel):
    item_id: uuid.UUID
    position_number: int
    configuration_name: str
    door_type: str
    quantity: int
    price_per_unit: Decimal | None
    total_price: Decimal | None
    status: OrderItemStatus
    doors_pending: int = 0
    doors_in_production: int = 0
    doors_ready: int = 0
    doors_shipped: int = 0
    doors_completed: int = 0


class OrderSummarySchema(BaseModel):
    order_id: uuid.UUID
    order_number: str
    client_name: str
    client_type: ClientType
    status: OrderStatus
    items_count: int
    total_doors: int

    subtotal: Decimal
    discount_amount: Decimal
    # Legacy fields (kept for backward compat)
    measurement_cost: Decimal
    delivery_cost: Decimal
    installation_cost: Decimal
    # New dynamic services
    services: list[ServiceLineSchema] = []
    services_total: Decimal = Decimal("0")

    total_before_vat: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_with_vat: Decimal

    prepayment_amount: Decimal | None
    outstanding_amount: Decimal | None

    items: list[ItemSummarySchema]


# ─── Paginated response ──────────────────────────────────────────────────────

class PaginatedOrdersSchema(BaseModel):
    items: list[OrderSchema]
    total: int
    page: int
    page_size: int
    pages: int


# ─── Apply markings schema (Sprint 8) ────────────────────────────────────────

class ApplyMarkingsSchema(BaseModel):
    marking_type: Literal["none", "auto", "manual"]
    prefix: str | None = Field(None, max_length=20)
    start_number: int | None = Field(None, ge=1)
    markings: list[str] | None = None  # для manual — список маркировок
