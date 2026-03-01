import uuid
from datetime import datetime
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

import enum


class DoorType(str, enum.Enum):
    technical = "technical"       # Технические (противопожарные, простые тех.)
    finish = "finish"             # С Отделкой (квартирные, коттедж, дача)


class FieldType(str, enum.Enum):
    select = "select"             # Выпадающий список
    text = "text"                 # Произвольный текст
    number = "number"             # Числовое значение
    boolean = "boolean"           # Да/Нет
    multiselect = "multiselect"   # Множественный выбор


class ConfigurationStatus(str, enum.Enum):
    draft = "draft"               # Черновик
    confirmed = "confirmed"       # Утверждена
    in_production = "in_production"  # В производстве
    completed = "completed"       # Завершена


class MarkingStatus(str, enum.Enum):
    pending = "pending"           # Ожидает
    in_production = "in_production"  # В производстве
    completed = "completed"       # Готова
    shipped = "shipped"           # Отгружена


class FieldLayer(str, enum.Enum):
    core = "core"                 # Ядро — конструктивные параметры (шаблон модели)
    variant = "variant"           # Надстройка — эстетические параметры (выбор при заказе)


class VisibilityRuleType(str, enum.Enum):
    show_when = "show_when"       # Показать поле когда зависимое = значению
    hide_when = "hide_when"       # Скрыть поле когда зависимое = значению


class DoorModel(Base):
    """Модель двери: Галант, Модена, Ei-30, Премиум и т.д."""
    __tablename__ = "door_models"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    label_short: Mapped[str | None] = mapped_column(String(100))
    door_type: Mapped[DoorType] = mapped_column(
        Enum(DoorType, name="door_type_enum", create_type=False), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    no_exterior: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_door_models_code", "code"),
        Index("idx_door_models_door_type", "door_type"),
        Index("idx_door_models_sort_order", "sort_order"),
    )


class DoorFieldGroup(Base):
    """Группа/секция полей конфигуратора: Размеры, Коробка, Отделка и т.д."""
    __tablename__ = "door_field_groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    door_type_applicability: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default='["technical","finish"]'
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_door_field_groups_code", "code"),
        Index("idx_door_field_groups_sort", "sort_order"),
    )


class DoorFieldDefinition(Base):
    """Определение полей конфигуратора — хранится в БД, редактируется через admin."""
    __tablename__ = "door_field_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    label_short: Mapped[str | None] = mapped_column(String(100))  # Для ТЗ/таблиц
    field_type: Mapped[FieldType] = mapped_column(
        Enum(FieldType, name="field_type_enum", create_type=False), nullable=False
    )
    group_code: Mapped[str] = mapped_column(String(100), nullable=False)
    group_label: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Для select/multiselect: [{"value": "...", "label": "..."}, ...]
    options: Mapped[dict | None] = mapped_column(JSONB)

    default_value: Mapped[str | None] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # К каким типам дверей применимо: ["technical", "finish"] или ["finish"]
    door_type_applicability: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default='["technical","finish"]'
    )

    # Единица измерения (для number полей): "мм", "кг", "шт"
    unit: Mapped[str | None] = mapped_column(String(20))

    # Слой конфигуратора: core (ядро) или variant (надстройка)
    layer: Mapped[FieldLayer] = mapped_column(
        Enum(FieldLayer, name="field_layer_enum", create_type=False),
        nullable=False,
        default=FieldLayer.core,
        server_default="core",
    )

    notes: Mapped[str | None] = mapped_column(Text)  # Подсказка для пользователя
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Отображение в строке позиции заказа
    is_display: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    visibility_rules: Mapped[list["DoorFieldVisibilityRule"]] = relationship(
        "DoorFieldVisibilityRule",
        foreign_keys="DoorFieldVisibilityRule.field_code",
        primaryjoin="DoorFieldDefinition.code == DoorFieldVisibilityRule.field_code",
        back_populates="field_definition",
        cascade="all, delete-orphan",
    )
    pricing_rules: Mapped[list["PricingRule"]] = relationship(
        "PricingRule",
        foreign_keys="PricingRule.field_code",
        primaryjoin="DoorFieldDefinition.code == PricingRule.field_code",
        back_populates="field_definition",
        cascade="all, delete-orphan",
    )
    material_norms: Mapped[list["MaterialNorm"]] = relationship(
        "MaterialNorm",
        foreign_keys="MaterialNorm.field_code",
        primaryjoin="DoorFieldDefinition.code == MaterialNorm.field_code",
        back_populates="field_definition",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_field_def_code", "code"),
        Index("idx_field_def_group", "group_code"),
        Index("idx_field_def_sort", "sort_order"),
    )


class DoorFieldVisibilityRule(Base):
    """Правила видимости полей: поле X показывается когда поле Y = значению Z."""
    __tablename__ = "door_field_visibility_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Поле, видимость которого контролируется
    field_code: Mapped[str] = mapped_column(
        String(100), ForeignKey("door_field_definitions.code", ondelete="CASCADE"), nullable=False
    )
    # Поле, от которого зависит видимость
    depends_on_field_code: Mapped[str] = mapped_column(String(100), nullable=False)
    # Значение (или список значений для OR), при котором применяется правило
    depends_on_value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    rule_type: Mapped[VisibilityRuleType] = mapped_column(
        Enum(VisibilityRuleType, name="visibility_rule_type_enum", create_type=False),
        nullable=False,
        default=VisibilityRuleType.show_when,
    )

    field_definition: Mapped["DoorFieldDefinition"] = relationship(
        "DoorFieldDefinition",
        foreign_keys=[field_code],
        back_populates="visibility_rules",
    )

    __table_args__ = (
        Index("idx_vis_rule_field_code", "field_code"),
        Index("idx_vis_rule_depends_on", "depends_on_field_code"),
    )


class DoorConfiguration(Base):
    """Конфигурация двери — основная сущность конфигуратора."""
    __tablename__ = "door_configurations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # FK на orders будет добавлен в миграции 0003
    order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    door_type: Mapped[DoorType] = mapped_column(
        Enum(DoorType, name="door_type_enum", create_type=False), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)  # Название позиции
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Все значения полей конфигуратора: {"field_code": "value", ...}
    values: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    # Расчётные поля (пересчитываются при сохранении)
    price_estimate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    cost_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    # Зафиксированные цены при подтверждении заказа (Sprint 1 / Блок 7)
    locked_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    locked_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    status: Mapped[ConfigurationStatus] = mapped_column(
        Enum(ConfigurationStatus, name="configuration_status_enum", create_type=False),
        nullable=False,
        default=ConfigurationStatus.draft,
    )

    # Модель двери (Sprint 13 — для маршрутизации производства)
    door_model_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("door_models.id", ondelete="SET NULL")
    )

    # Шаблон: если True — глобальное ядро, переиспользуется в заказах
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    markings: Mapped[list["DoorMarking"]] = relationship(
        "DoorMarking", back_populates="configuration", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_door_config_order_id", "order_id"),
        Index("idx_door_config_status", "status"),
        Index("idx_door_config_created_by", "created_by"),
        Index("idx_door_config_model_id", "door_model_id"),
    )


class DoorMarking(Base):
    """Маркировка отдельной двери в рамках конфигурации.

    Каждая физическая дверь получает уникальную маркировку (напр. Д3-001).
    """
    __tablename__ = "door_markings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    configuration_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("door_configurations.id", ondelete="CASCADE"),
        nullable=False,
    )
    marking: Mapped[str] = mapped_column(String(50), nullable=False)  # Д3-001, А1-04
    floor: Mapped[str | None] = mapped_column(String(50))              # Этаж
    building_block: Mapped[str | None] = mapped_column(String(100))    # Подъезд/блок ("Пятно 1")
    apartment_number: Mapped[str | None] = mapped_column(String(50))   # Номер квартиры
    location_description: Mapped[str | None] = mapped_column(String(300))  # Описание
    status: Mapped[MarkingStatus] = mapped_column(
        Enum(MarkingStatus, name="marking_status_enum", create_type=False),
        nullable=False,
        default=MarkingStatus.pending,
    )
    qr_code: Mapped[str | None] = mapped_column(String(500))  # URL/данные QR-кода
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    configuration: Mapped["DoorConfiguration"] = relationship(
        "DoorConfiguration", back_populates="markings"
    )

    __table_args__ = (
        UniqueConstraint("configuration_id", "marking", name="uq_marking_per_config"),
        Index("idx_marking_config_id", "configuration_id"),
        Index("idx_marking_status", "status"),
    )


class PricingRule(Base):
    """Таблица цен: для каждого значения поля — прайс и себестоимость компонента."""
    __tablename__ = "pricing_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    field_code: Mapped[str] = mapped_column(
        String(100), ForeignKey("door_field_definitions.code", ondelete="CASCADE"), nullable=False
    )
    field_value: Mapped[str] = mapped_column(String(200), nullable=False)

    # Добавка к цене продажи (за единицу)
    price_component: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default="0"
    )
    # Добавка к себестоимости (за единицу)
    cost_component: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default="0"
    )

    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    notes: Mapped[str | None] = mapped_column(Text)

    field_definition: Mapped["DoorFieldDefinition"] = relationship(
        "DoorFieldDefinition", foreign_keys=[field_code], back_populates="pricing_rules"
    )

    __table_args__ = (
        Index("idx_pricing_field_code", "field_code"),
        Index("idx_pricing_field_value", "field_code", "field_value"),
    )


class MaterialNorm(Base):
    """Нормы расхода материалов: формула расчёта количества по параметрам двери."""
    __tablename__ = "material_norms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    field_code: Mapped[str] = mapped_column(
        String(100), ForeignKey("door_field_definitions.code", ondelete="CASCADE"), nullable=False
    )
    field_value: Mapped[str] = mapped_column(String(200), nullable=False)

    material_name: Mapped[str] = mapped_column(String(200), nullable=False)
    material_code: Mapped[str | None] = mapped_column(String(100))  # Артикул
    unit: Mapped[str] = mapped_column(String(20), nullable=False)   # кг, м², шт, м.п.

    # Формула расчёта количества. Переменные: height, width, quantity
    # Пример: "(height * width) / 1000000 * 1.05"
    quantity_formula: Mapped[str] = mapped_column(Text, nullable=False)

    notes: Mapped[str | None] = mapped_column(Text)

    field_definition: Mapped["DoorFieldDefinition"] = relationship(
        "DoorFieldDefinition", foreign_keys=[field_code], back_populates="material_norms"
    )

    __table_args__ = (
        Index("idx_material_norm_field_code", "field_code"),
    )
