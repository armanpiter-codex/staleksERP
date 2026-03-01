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


# ─── ProductionWorkshop ──────────────────────────────────────────────────────

class ProductionWorkshop(Base):
    """Цех производства (Металл, МДФ, Сборка и т.д.)"""
    __tablename__ = "production_workshops"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(7))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_production_workshops_code", "code"),
        Index("idx_production_workshops_sort_order", "sort_order"),
    )


# ─── ProductionStage ──────────────────────────────────────────────────────────

class ProductionStage(Base):
    """Этап производства (Резка, Сварка, МДФ прессовка, ОТК и т.д.)"""
    __tablename__ = "production_stages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Workshop FK (Sprint 16)
    workshop_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_workshops.id", ondelete="SET NULL")
    )
    workshop: Mapped["ProductionWorkshop | None"] = relationship(
        "ProductionWorkshop", lazy="selectin"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_production_stages_code", "code"),
        Index("idx_production_stages_sort_order", "sort_order"),
        Index("idx_production_stages_workshop", "workshop_id"),
    )


# ─── ProductionRoute ─────────────────────────────────────────────────────────

class ProductionRoute(Base):
    """Шаг маршрута: привязка этапа к модели двери с фазой и цехом."""
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

    # Phase & Workshop (Sprint 16)
    phase: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    workshop_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_workshops.id", ondelete="SET NULL")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    stage: Mapped["ProductionStage"] = relationship("ProductionStage", lazy="selectin")
    workshop: Mapped["ProductionWorkshop | None"] = relationship(
        "ProductionWorkshop", lazy="selectin"
    )

    __table_args__ = (
        UniqueConstraint("door_model_id", "stage_id", name="uq_route_model_stage"),
        Index("uq_route_model_phase_workshop_step", "door_model_id", "phase", "workshop_id", "step_order", unique=True),
        Index("idx_production_routes_model_id", "door_model_id"),
        Index("idx_production_routes_stage_id", "stage_id"),
        Index("idx_production_routes_phase", "door_model_id", "phase"),
    )


# ─── DoorWorkshopProgress ───────────────────────────────────────────────────

class DoorWorkshopProgress(Base):
    """Прогресс двери по цеху/фазе: отслеживание параллельных треков."""
    __tablename__ = "door_workshop_progress"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    door_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_doors.id", ondelete="CASCADE"), nullable=False
    )
    workshop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_workshops.id", ondelete="CASCADE"), nullable=False
    )
    phase: Mapped[int] = mapped_column(Integer, nullable=False)
    current_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_stages.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    workshop: Mapped["ProductionWorkshop"] = relationship("ProductionWorkshop", lazy="selectin")
    current_stage: Mapped["ProductionStage | None"] = relationship("ProductionStage", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("door_id", "workshop_id", "phase", name="uq_door_workshop_phase"),
        Index("idx_dwp_door", "door_id"),
        Index("idx_dwp_stage", "current_stage_id"),
        Index("idx_dwp_status", "status"),
        Index("idx_dwp_workshop", "workshop_id"),
    )


# ─── LaunchCheckDefinition ───────────────────────────────────────────────────

class LaunchCheckDefinition(Base):
    """Пункт предзапускного чеклиста (настраивается технологом)."""
    __tablename__ = "launch_check_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_launch_check_defs_sort", "sort_order"),
    )


# ─── DoorLaunchCheck ─────────────────────────────────────────────────────────

class DoorLaunchCheck(Base):
    """Факт выполнения пункта чеклиста для конкретной двери."""
    __tablename__ = "door_launch_checks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    door_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_doors.id", ondelete="CASCADE"), nullable=False
    )
    check_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("launch_check_definitions.id", ondelete="CASCADE"), nullable=False
    )
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    done_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    check_def: Mapped["LaunchCheckDefinition"] = relationship(
        "LaunchCheckDefinition", lazy="selectin"
    )

    __table_args__ = (
        UniqueConstraint("door_id", "check_id", name="uq_door_check"),
        Index("idx_door_launch_checks_door", "door_id"),
        Index("idx_door_launch_checks_check", "check_id"),
        Index("idx_door_launch_checks_done", "is_done"),
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
