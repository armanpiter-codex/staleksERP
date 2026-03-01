"""Door stage movement — workshop-aware parallel movement (Sprint 16).

Supports parallel workshop tracks within phases:
- Phase 1 can have Metal and MDF workshops running simultaneously
- Phase N+1 starts only when ALL tracks in Phase N are complete
- Auto-transition to ready_for_shipment after last phase completes
"""
import uuid
import logging
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import BadRequestException, NotFoundException
from app.orders.models import DoorStatus, OrderDoor, OrderItem
from app.configurator.models import DoorConfiguration
from app.production.models import (
    DoorStageHistory,
    DoorWorkshopProgress,
    ProductionRoute,
    ProductionStage,
)

logger = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_door(db: AsyncSession, door_id: uuid.UUID) -> OrderDoor:
    result = await db.execute(
        select(OrderDoor).where(OrderDoor.id == door_id)
    )
    door = result.scalar_one_or_none()
    if not door:
        raise NotFoundException("Дверь не найдена")
    return door


async def _get_route_for_door(
    db: AsyncSession,
    door: OrderDoor,
) -> list[ProductionRoute]:
    """Get production route for a door via: door → item → config → door_model_id → routes."""
    item_result = await db.execute(
        select(OrderItem).where(OrderItem.id == door.order_item_id)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        return []

    config_result = await db.execute(
        select(DoorConfiguration).where(DoorConfiguration.id == item.configuration_id)
    )
    config = config_result.scalar_one_or_none()
    if not config or not config.door_model_id:
        return []

    route_result = await db.execute(
        select(ProductionRoute)
        .where(ProductionRoute.door_model_id == config.door_model_id)
        .options(
            selectinload(ProductionRoute.stage),
            selectinload(ProductionRoute.workshop),
        )
        .order_by(ProductionRoute.phase, ProductionRoute.step_order)
    )
    return list(route_result.scalars().all())


async def _record_history(
    db: AsyncSession,
    door_id: uuid.UUID,
    from_stage_id: uuid.UUID | None,
    to_stage_id: uuid.UUID,
    user_id: uuid.UUID,
    notes: str | None = None,
) -> DoorStageHistory:
    entry = DoorStageHistory(
        door_id=door_id,
        from_stage_id=from_stage_id,
        to_stage_id=to_stage_id,
        moved_by=user_id,
        notes=notes,
    )
    db.add(entry)
    return entry


async def _get_door_progress(
    db: AsyncSession,
    door_id: uuid.UUID,
) -> list[DoorWorkshopProgress]:
    result = await db.execute(
        select(DoorWorkshopProgress)
        .where(DoorWorkshopProgress.door_id == door_id)
        .options(
            selectinload(DoorWorkshopProgress.workshop),
            selectinload(DoorWorkshopProgress.current_stage),
        )
        .order_by(DoorWorkshopProgress.phase, DoorWorkshopProgress.workshop_id)
    )
    return list(result.scalars().all())


async def _update_primary_stage(db: AsyncSession, door: OrderDoor) -> None:
    """Update denormalized order_doors.current_stage_id from active progress."""
    result = await db.execute(
        select(DoorWorkshopProgress.current_stage_id)
        .where(
            DoorWorkshopProgress.door_id == door.id,
            DoorWorkshopProgress.status == "active",
            DoorWorkshopProgress.current_stage_id.isnot(None),
        )
        .order_by(DoorWorkshopProgress.phase, DoorWorkshopProgress.workshop_id)
        .limit(1)
    )
    door.current_stage_id = result.scalar_one_or_none()


def _group_route_by_phase(
    route: list[ProductionRoute],
) -> dict[int, dict[uuid.UUID, list[ProductionRoute]]]:
    """Group route steps by phase → workshop_id → sorted steps."""
    phases: dict[int, dict[uuid.UUID, list[ProductionRoute]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for step in route:
        if step.workshop_id:
            phases[step.phase][step.workshop_id].append(step)
    # Sort steps within each track
    for phase_tracks in phases.values():
        for ws_id in phase_tracks:
            phase_tracks[ws_id].sort(key=lambda s: s.step_order)
    return dict(phases)


# ─── Initialize ──────────────────────────────────────────────────────────────

async def initialize_door_production(
    db: AsyncSession,
    door_id: uuid.UUID,
    user_id: uuid.UUID,
) -> OrderDoor:
    """Called when door enters in_production. Creates workshop progress entries."""
    door = await _get_door(db, door_id)
    route = await _get_route_for_door(db, door)

    if not route:
        logger.info(f"Door {door_id}: no production route defined, skipping stage init")
        return door

    phases = _group_route_by_phase(route)
    if not phases:
        # Fallback for routes without workshops: use first stage directly
        first_stage_id = route[0].stage_id
        door.current_stage_id = first_stage_id
        await _record_history(db, door_id, None, first_stage_id, user_id)
        await db.flush()
        return door

    first_phase = min(phases.keys())
    first_stage_id = None

    for phase_num in sorted(phases.keys()):
        for workshop_id, steps in phases[phase_num].items():
            is_first_phase = (phase_num == first_phase)

            progress = DoorWorkshopProgress(
                door_id=door_id,
                workshop_id=workshop_id,
                phase=phase_num,
                current_stage_id=steps[0].stage_id if is_first_phase else None,
                status="active" if is_first_phase else "pending",
                started_at=datetime.now(timezone.utc) if is_first_phase else None,
            )
            db.add(progress)

            if is_first_phase:
                await _record_history(db, door_id, None, steps[0].stage_id, user_id)
                if first_stage_id is None:
                    first_stage_id = steps[0].stage_id

    door.current_stage_id = first_stage_id
    await db.flush()
    return door


# ─── Move next ───────────────────────────────────────────────────────────────

async def move_door_to_next_stage(
    db: AsyncSession,
    door_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    workshop_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> OrderDoor:
    """Advance door to next stage within a workshop track."""
    door = await _get_door(db, door_id)
    if door.status != DoorStatus.in_production:
        raise BadRequestException("Дверь не в производстве")

    progress_list = await _get_door_progress(db, door_id)
    active_progress = [p for p in progress_list if p.status == "active"]

    if not active_progress:
        return await _legacy_move_next(db, door, user_id, notes)

    target = _resolve_workshop_target(active_progress, workshop_id)

    route = await _get_route_for_door(db, door)
    phases = _group_route_by_phase(route)
    track_steps = phases.get(target.phase, {}).get(target.workshop_id, [])

    if not track_steps:
        raise BadRequestException("Маршрут цеха не найден")

    current_idx = next(
        (i for i, s in enumerate(track_steps) if s.stage_id == target.current_stage_id),
        None,
    )
    if current_idx is None:
        raise BadRequestException("Текущий этап не найден в маршруте цеха")

    from_stage_id = target.current_stage_id

    if current_idx + 1 < len(track_steps):
        next_stage_id = track_steps[current_idx + 1].stage_id
        target.current_stage_id = next_stage_id
        await _record_history(db, door_id, from_stage_id, next_stage_id, user_id, notes)
    else:
        target.status = "completed"
        target.completed_at = datetime.now(timezone.utc)
        target.current_stage_id = None
        await _record_history(
            db, door_id, from_stage_id, track_steps[-1].stage_id, user_id,
            notes or "Цех завершён",
        )
        await _try_advance_phase(db, door, target.phase, user_id, progress_list, phases)

    await _update_primary_stage(db, door)
    await db.flush()
    return door


# ─── Move prev ───────────────────────────────────────────────────────────────

async def move_door_to_prev_stage(
    db: AsyncSession,
    door_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    workshop_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> OrderDoor:
    """Move door back to previous stage within a workshop track."""
    door = await _get_door(db, door_id)
    if door.status != DoorStatus.in_production:
        raise BadRequestException("Дверь не в производстве")

    progress_list = await _get_door_progress(db, door_id)
    active_progress = [p for p in progress_list if p.status == "active"]

    if not active_progress:
        return await _legacy_move_prev(db, door, user_id, notes)

    target = _resolve_workshop_target(active_progress, workshop_id)

    route = await _get_route_for_door(db, door)
    phases = _group_route_by_phase(route)
    track_steps = phases.get(target.phase, {}).get(target.workshop_id, [])

    if not track_steps:
        raise BadRequestException("Маршрут цеха не найден")

    current_idx = next(
        (i for i, s in enumerate(track_steps) if s.stage_id == target.current_stage_id),
        None,
    )
    if current_idx is None:
        raise BadRequestException("Текущий этап не найден в маршруте цеха")
    if current_idx == 0:
        raise BadRequestException("Дверь уже на первом этапе цеха")

    from_stage_id = target.current_stage_id
    prev_stage_id = track_steps[current_idx - 1].stage_id
    target.current_stage_id = prev_stage_id

    await _record_history(db, door_id, from_stage_id, prev_stage_id, user_id, notes)
    await _update_primary_stage(db, door)
    await db.flush()
    return door


# ─── Move to specific stage ──────────────────────────────────────────────────

async def move_door_to_stage(
    db: AsyncSession,
    door_id: uuid.UUID,
    stage_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    workshop_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> OrderDoor:
    """Move door to a specific stage (must be in its route)."""
    door = await _get_door(db, door_id)
    if door.status != DoorStatus.in_production:
        raise BadRequestException("Дверь не в производстве")

    route = await _get_route_for_door(db, door)
    if not route:
        raise BadRequestException("Маршрут не настроен для модели этой двери")

    valid_stage_ids = {step.stage_id for step in route}
    if stage_id not in valid_stage_ids:
        raise BadRequestException("Указанный этап не входит в маршрут этой модели")

    target_step = next((s for s in route if s.stage_id == stage_id), None)
    if not target_step:
        raise BadRequestException("Этап не найден в маршруте")

    progress_list = await _get_door_progress(db, door_id)

    if progress_list and target_step.workshop_id:
        target_progress = next(
            (p for p in progress_list
             if p.workshop_id == target_step.workshop_id and p.phase == target_step.phase),
            None,
        )
        if target_progress:
            from_stage_id = target_progress.current_stage_id
            target_progress.current_stage_id = stage_id
            if target_progress.status == "pending":
                target_progress.status = "active"
                target_progress.started_at = datetime.now(timezone.utc)
            await _record_history(db, door_id, from_stage_id, stage_id, user_id, notes)
            await _update_primary_stage(db, door)
            await db.flush()
            return door

    from_stage_id = door.current_stage_id
    door.current_stage_id = stage_id
    await _record_history(db, door_id, from_stage_id, stage_id, user_id, notes)
    await db.flush()
    return door


# ─── History & Progress ──────────────────────────────────────────────────────

async def get_door_history(
    db: AsyncSession,
    door_id: uuid.UUID,
) -> list[DoorStageHistory]:
    result = await db.execute(
        select(DoorStageHistory)
        .where(DoorStageHistory.door_id == door_id)
        .options(
            selectinload(DoorStageHistory.from_stage),
            selectinload(DoorStageHistory.to_stage),
        )
        .order_by(DoorStageHistory.moved_at)
    )
    return list(result.scalars().all())


async def get_door_progress(
    db: AsyncSession,
    door_id: uuid.UUID,
) -> list[DoorWorkshopProgress]:
    return await _get_door_progress(db, door_id)


# ─── Internal helpers ────────────────────────────────────────────────────────

def _resolve_workshop_target(
    active_progress: list[DoorWorkshopProgress],
    workshop_id: uuid.UUID | None,
) -> DoorWorkshopProgress:
    if len(active_progress) == 1:
        target = active_progress[0]
        if workshop_id and target.workshop_id != workshop_id:
            raise BadRequestException("Указанный цех не активен для этой двери")
        return target

    if not workshop_id:
        raise BadRequestException(
            "У двери несколько активных цехов. Укажите workshop_id."
        )

    target = next(
        (p for p in active_progress if p.workshop_id == workshop_id), None
    )
    if not target:
        raise BadRequestException("Указанный цех не активен для этой двери")
    return target


async def _try_advance_phase(
    db: AsyncSession,
    door: OrderDoor,
    completed_phase: int,
    user_id: uuid.UUID,
    all_progress: list[DoorWorkshopProgress],
    phases: dict[int, dict[uuid.UUID, list[ProductionRoute]]],
) -> None:
    phase_entries = [p for p in all_progress if p.phase == completed_phase]

    if not all(p.status in ("completed", "skipped") for p in phase_entries):
        return

    next_phase = completed_phase + 1
    next_entries = [p for p in all_progress if p.phase == next_phase]

    if next_entries:
        for entry in next_entries:
            track_steps = phases.get(next_phase, {}).get(entry.workshop_id, [])
            if track_steps:
                entry.status = "active"
                entry.current_stage_id = track_steps[0].stage_id
                entry.started_at = datetime.now(timezone.utc)
                await _record_history(
                    db, door.id, None, track_steps[0].stage_id, user_id,
                )
        logger.info(f"Door {door.id}: phase {completed_phase} done, activated phase {next_phase}")
    else:
        door.status = DoorStatus.ready_for_shipment
        door.current_stage_id = None
        for p in all_progress:
            if p.status == "active":
                p.status = "completed"
                p.completed_at = datetime.now(timezone.utc)
        logger.info(f"Door {door.id}: all phases complete → ready_for_shipment")


# ─── Legacy fallbacks (routes without workshops) ────────────────────────────

async def _legacy_move_next(
    db: AsyncSession, door: OrderDoor, user_id: uuid.UUID, notes: str | None,
) -> OrderDoor:
    route = await _get_route_for_door(db, door)
    if not route:
        raise BadRequestException("Маршрут не настроен для модели этой двери")
    if not door.current_stage_id:
        raise BadRequestException("У двери не установлен текущий этап")

    current_idx = next(
        (i for i, s in enumerate(route) if s.stage_id == door.current_stage_id), None
    )
    if current_idx is None:
        raise BadRequestException("Текущий этап не найден в маршруте")

    from_stage_id = door.current_stage_id
    if current_idx + 1 < len(route):
        next_stage_id = route[current_idx + 1].stage_id
        door.current_stage_id = next_stage_id
        await _record_history(db, door.id, from_stage_id, next_stage_id, user_id, notes)
    else:
        door.status = DoorStatus.ready_for_shipment
        door.current_stage_id = None
        await _record_history(
            db, door.id, from_stage_id, route[-1].stage_id, user_id,
            notes or "Последний этап завершён → готова к отгрузке",
        )
    await db.flush()
    return door


async def _legacy_move_prev(
    db: AsyncSession, door: OrderDoor, user_id: uuid.UUID, notes: str | None,
) -> OrderDoor:
    route = await _get_route_for_door(db, door)
    if not route:
        raise BadRequestException("Маршрут не настроен для модели этой двери")
    if not door.current_stage_id:
        raise BadRequestException("У двери не установлен текущий этап")

    current_idx = next(
        (i for i, s in enumerate(route) if s.stage_id == door.current_stage_id), None
    )
    if current_idx is None:
        raise BadRequestException("Текущий этап не найден в маршруте")
    if current_idx == 0:
        raise BadRequestException("Дверь уже на первом этапе маршрута")

    from_stage_id = door.current_stage_id
    prev_stage_id = route[current_idx - 1].stage_id
    door.current_stage_id = prev_stage_id
    await _record_history(db, door.id, from_stage_id, prev_stage_id, user_id, notes)
    await db.flush()
    return door
