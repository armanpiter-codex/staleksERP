import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ─── ProductionStage ──────────────────────────────────────────────────────────

class ProductionStage(Base):
    """Этап/цех производства (Проектирование, Металл, МДФ, Сборка, ОТК и т.д.)"""
    __tablename__ = "production_stages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_production_stages_code", "code"),
        Index("idx_production_stages_sort_order", "sort_order"),
    )


# ─── ProductionRoute ─────────────────────────────────────────────────────────

class ProductionRoute(Base):
    """Шаг маршрута: привязка этапа к модели двери с порядковым номером."""
    __tablename__ = "production_routes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    door_model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("door_models.id", ondelete="CASCADE"), nullable=False
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_stages.id", ondelete="CASCADE"), nullable=False
    )
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    stage: Mapped["ProductionStage"] = relationship("ProductionStage", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("door_model_id", "stage_id", name="uq_route_model_stage"),
        UniqueConstraint("door_model_id", "step_order", name="uq_route_model_step"),
        Index("idx_production_routes_model_id", "door_model_id"),
        Index("idx_production_routes_stage_id", "stage_id"),
    )


# ─── DoorStageHistory ────────────────────────────────────────────────────────

class DoorStageHistory(Base):
    """Аудит-лог перемещения двери между этапами производства."""
    __tablename__ = "door_stage_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    door_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_doors.id", ondelete="CASCADE"), nullable=False
    )
    from_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_stages.id", ondelete="SET NULL")
    )
    to_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_stages.id", ondelete="SET NULL"), nullable=False
    )
    moved_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text)
    moved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    from_stage: Mapped["ProductionStage | None"] = relationship(
        "ProductionStage", foreign_keys=[from_stage_id], lazy="selectin"
    )
    to_stage: Mapped["ProductionStage"] = relationship(
        "ProductionStage", foreign_keys=[to_stage_id], lazy="selectin"
    )

    __table_args__ = (
        Index("idx_door_stage_history_door_id", "door_id"),
        Index("idx_door_stage_history_to_stage", "to_stage_id"),
        Index("idx_door_stage_history_moved_at", "moved_at"),
    )
