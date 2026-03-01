import uuid
import enum
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.services.models import BillingMethod


class ClientType(str, enum.Enum):
    b2b = "b2b"
    b2c = "b2c"


class OrderStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"              # Согласован
    contract_signed = "contract_signed"  # Договор подписан
    active = "active"                    # Активный (авто при запуске в производство)
    completed = "completed"
    cancelled = "cancelled"
    # Legacy (в DB enum, в коде не используются):
    measurement = "measurement"
    in_production = "in_production"
    shipped = "shipped"


class OrderItemStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    in_production = "in_production"
    ready_for_shipment = "ready_for_shipment"
    shipped = "shipped"
    completed = "completed"
    cancelled = "cancelled"


class DoorStatus(str, enum.Enum):
    pending = "pending"
    in_production = "in_production"
    ready_for_shipment = "ready_for_shipment"
    shipped = "shipped"
    completed = "completed"


class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    partial = "partial"
    paid = "paid"
    refunded = "refunded"


class SalesChannel(str, enum.Enum):
    corporate = "corporate"
    dealer = "dealer"
    retail = "retail"


# ─── OrderDoor ─────────────────────────────────────────────────────────────────

class OrderDoor(Base):
    """Физическая дверь в заказе.

    Каждая дверь имеет уникальный внутренний номер (internal_number)
    и опциональную маркировку (marking) для строителей/монтажников.
    Статус отслеживает движение двери через производство.
    """
    __tablename__ = "order_doors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Уникальный внутренний номер (генерируется системой: D-00001)
    internal_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    # Маркировка для строителей/монтажников (заполняет МОП)
    marking: Mapped[str | None] = mapped_column(String(50))
    floor: Mapped[str | None] = mapped_column(String(50))
    building_block: Mapped[str | None] = mapped_column(String(100))
    apartment_number: Mapped[str | None] = mapped_column(String(50))
    location_description: Mapped[str | None] = mapped_column(String(300))

    # Статус двери (для производства)
    status: Mapped[DoorStatus] = mapped_column(
        Enum(DoorStatus, name="door_status_enum", create_type=False),
        nullable=False,
        default=DoorStatus.pending,
    )

    # Приоритет (МОП ставит для конкретных дверей)
    priority: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Текущий этап производства (Sprint 13)
    current_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_stages.id", ondelete="SET NULL")
    )

    qr_code: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    order_item: Mapped["OrderItem"] = relationship("OrderItem", back_populates="doors")

    __table_args__ = (
        Index("idx_order_doors_item_id", "order_item_id"),
        Index("idx_order_doors_status", "status"),
        Index("idx_order_doors_internal", "internal_number"),
        Index("idx_order_doors_current_stage", "current_stage_id"),
    )


# ─── OrderItem ─────────────────────────────────────────────────────────────────

class OrderItem(Base):
    """Позиция заказа — группа одинаковых дверей.

    Связывает заказ с конфигурацией двери. Имеет свой статус (для менеджера)
    и содержит OrderDoor записи (для производства).
    """
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    configuration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("door_configurations.id", ondelete="RESTRICT"), nullable=False
    )
    position_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Статус позиции (ставится менеджером)
    status: Mapped[OrderItemStatus] = mapped_column(
        Enum(OrderItemStatus, name="order_item_status_enum", create_type=False),
        nullable=False,
        default=OrderItemStatus.draft,
    )

    # Зафиксированные цены
    locked_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    locked_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    # Sprint 4: Variant (надстройка) — эстетические параметры, выбранные при заказе
    variant_values: Mapped[dict] = mapped_column(JSONB, server_default="{}", default=dict)
    variant_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), server_default="0", default=Decimal("0")
    )
    variant_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), server_default="0", default=Decimal("0")
    )

    # Приоритет (для всей позиции)
    priority: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="items")
    configuration = relationship("DoorConfiguration", lazy="selectin")
    doors: Mapped[list["OrderDoor"]] = relationship(
        "OrderDoor", back_populates="order_item", cascade="all, delete-orphan", lazy="selectin"
    )

    # Computed properties for Pydantic from_attributes=True
    @property
    def configuration_name(self) -> str:
        return self.configuration.name if self.configuration else "—"

    @property
    def door_type(self) -> str:
        return self.configuration.door_type.value if self.configuration else "—"

    @property
    def price_per_unit(self) -> Decimal | None:
        if self.locked_price is not None:
            return self.locked_price
        core_price = self.configuration.price_estimate if self.configuration else None
        if core_price is None:
            return None
        return core_price + (self.variant_price or Decimal("0"))

    @property
    def total_price(self) -> Decimal | None:
        p = self.price_per_unit
        return (p * self.quantity) if p is not None else None

    @property
    def doors_count(self) -> int:
        return len(self.doors) if self.doors else 0

    @property
    def doors_pending(self) -> int:
        return sum(1 for d in (self.doors or []) if d.status == DoorStatus.pending)

    @property
    def doors_in_production(self) -> int:
        return sum(1 for d in (self.doors or []) if d.status == DoorStatus.in_production)

    @property
    def doors_ready(self) -> int:
        return sum(1 for d in (self.doors or []) if d.status == DoorStatus.ready_for_shipment)

    @property
    def doors_shipped(self) -> int:
        return sum(1 for d in (self.doors or []) if d.status == DoorStatus.shipped)

    @property
    def doors_completed(self) -> int:
        return sum(1 for d in (self.doors or []) if d.status == DoorStatus.completed)

    __table_args__ = (
        UniqueConstraint("order_id", "position_number", name="uq_order_items_order_position"),
        Index("idx_order_items_order_id", "order_id"),
        Index("idx_order_items_config_id", "configuration_id"),
        Index("idx_order_items_status", "status"),
    )


# ─── Facility ──────────────────────────────────────────────────────────────────

class Facility(Base):
    """Строительный объект — центральная сущность для привязки заказов, снабжения, расходов."""
    __tablename__ = "facilities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="facility")


# ─── OrderService ─────────────────────────────────────────────────────────────

class OrderService(Base):
    """Привязка услуги к заказу — менеджер выбирает из настроенных типов."""
    __tablename__ = "order_services"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    service_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("service_types.id", ondelete="RESTRICT"), nullable=False
    )
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0", nullable=False)
    billing_method: Mapped[BillingMethod] = mapped_column(
        Enum(BillingMethod, name="billing_method_enum", create_type=False),
        nullable=False,
        default=BillingMethod.separate,
    )
    billing_entity_name: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="services")
    service_type = relationship("app.services.models.ServiceType", lazy="selectin")

    # Computed for Pydantic
    @property
    def service_type_code(self) -> str:
        return self.service_type.code if self.service_type else ""

    @property
    def service_type_name(self) -> str:
        return self.service_type.name if self.service_type else ""

    @property
    def service_type_icon(self) -> str | None:
        return self.service_type.icon if self.service_type else None

    __table_args__ = (
        UniqueConstraint("order_id", "service_type_id", name="uq_order_services_order_type"),
        Index("idx_order_services_order_id", "order_id"),
    )


# ─── Order ─────────────────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    # Клиент
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    client_phone: Mapped[str | None] = mapped_column(String(30))
    client_email: Mapped[str | None] = mapped_column(String(255))
    client_type: Mapped[ClientType] = mapped_column(
        Enum(ClientType, name="client_type_enum", create_type=False), nullable=False
    )
    client_company: Mapped[str | None] = mapped_column(String(200))

    # Статус заказа (упрощённый)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status_enum", create_type=False),
        nullable=False,
        default=OrderStatus.draft,
    )

    # Финансы
    total_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    prepayment_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum", create_type=False),
        nullable=False,
        default=PaymentStatus.unpaid,
    )
    credit_days: Mapped[int | None] = mapped_column(Integer)

    # Прочее
    notes: Mapped[str | None] = mapped_column(Text)
    delivery_address: Mapped[str | None] = mapped_column(Text)
    desired_delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # FK на менеджера
    manager_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Sprint 1 fields
    measurer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    measurement_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), server_default="0"
    )
    object_name: Mapped[str | None] = mapped_column(String(300))  # legacy text, replaced by facility_id

    # Объект строительства (FK на Facility)
    facility_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("facilities.id"), nullable=True
    )
    facility: Mapped["Facility | None"] = relationship("Facility", back_populates="orders")

    sales_channel: Mapped[SalesChannel | None] = mapped_column(
        Enum(SalesChannel, name="sales_channel_enum", create_type=False), nullable=True
    )
    vat_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), server_default="16"
    )
    delivery_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), server_default="0"
    )
    installation_cost: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), server_default="0"
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    production_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str | None] = mapped_column(String(100))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="OrderItem.position_number",
    )
    services: Mapped[list["OrderService"]] = relationship(
        "OrderService",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def facility_name(self) -> str | None:
        """Computed property для Pydantic schema (from_attributes=True)."""
        return self.facility.name if self.facility else None

    __table_args__ = (
        Index("idx_orders_order_number", "order_number"),
        Index("idx_orders_client_type", "client_type"),
        Index("idx_orders_status", "status"),
        Index("idx_orders_manager_id", "manager_id"),
        Index("idx_orders_created_at", "created_at"),
        Index("idx_orders_measurer_id", "measurer_id"),
        Index("idx_orders_sales_channel", "sales_channel"),
    )
