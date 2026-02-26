"""Service types — настройка типов услуг технологом."""
import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BillingMethod(str, enum.Enum):
    included = "included"    # В цене двери
    separate = "separate"    # Отдельно (возможно другое юр.лицо)
    free = "free"            # Бесплатно


class ServiceType(Base):
    """Тип услуги — настраивается технологом, используется менеджером в заказах."""
    __tablename__ = "service_types"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(50))
    default_price: Mapped[float] = mapped_column(
        Numeric(12, 2), server_default="0", nullable=False
    )
    billing_method: Mapped[BillingMethod] = mapped_column(
        Enum(BillingMethod, name="billing_method_enum", create_type=False),
        nullable=False,
        default=BillingMethod.separate,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
