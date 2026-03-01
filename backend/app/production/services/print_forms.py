"""Print form data assembly for production doors.

Sprint 14 — assembles enriched data for door print cards and stage summaries.
Sprint 16 — workshop/phase-aware progress display.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.common.exceptions import NotFoundException
from app.configurator.models import DoorConfiguration, DoorFieldDefinition, DoorModel
from app.orders.models import DoorStatus, Order, OrderDoor, OrderItem
from app.production.models import (
    DoorStageHistory,
    DoorWorkshopProgress,
    ProductionRoute,
    ProductionStage,
)
from app.production.schemas import (
    DoorPrintDataSchema,
    PrintFieldGroupSchema,
    PrintFieldValueSchema,
    RouteStageForPrintSchema,
    StagePrintDataSchema,
    StagePrintDoorSchema,
)


def _resolve_field_value(
    field_def: DoorFieldDefinition,
    raw_value: object,
) -> str:
    """Resolve a raw config value to its display label."""
    if raw_value is None:
        return ""

    str_val = str(raw_value)

    # For select/multiselect — lookup option label
    if field_def.field_type in ("select", "multiselect") and field_def.options:
        options_list = field_def.options if isinstance(field_def.options, list) else []
        for opt in options_list:
            opt_val = opt.get("value", "") if isinstance(opt, dict) else getattr(opt, "value", "")
            opt_label = opt.get("label", "") if isinstance(opt, dict) else getattr(opt, "label", "")
            if str(opt_val) == str_val:
                return opt_label

        # multiselect: value might be comma-separated or a list
        if field_def.field_type == "multiselect" and isinstance(raw_value, list):
            labels = []
            for v in raw_value:
                found = False
                for opt in options_list:
                    opt_val = opt.get("value", "") if isinstance(opt, dict) else getattr(opt, "value", "")
                    opt_label = opt.get("label", "") if isinstance(opt, dict) else getattr(opt, "label", "")
                    if str(opt_val) == str(v):
                        labels.append(opt_label)
                        found = True
                        break
                if not found:
                    labels.append(str(v))
            return ", ".join(labels)

    # Boolean
    if field_def.field_type == "boolean":
        return "Да" if raw_value in (True, "true", "True", "1", 1) else "Нет"

    return str_val


async def get_door_print_data(
    db: AsyncSession,
    door_id: uuid.UUID,
) -> DoorPrintDataSchema:
    """Assemble enriched print data for a single production door."""

    # 1. Fetch door with relationships
    result = await db.execute(
        select(OrderDoor).where(OrderDoor.id == door_id)
    )
    door = result.scalar_one_or_none()
    if not door:
        raise NotFoundException("Door not found")

    # 2. Fetch OrderItem + Order + Configuration
    result = await db.execute(
        select(OrderItem)
        .where(OrderItem.id == door.order_item_id)
        .options(
            selectinload(OrderItem.order).selectinload(Order.facility),
            selectinload(OrderItem.configuration),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundException("Order item not found")

    order = item.order
    config = item.configuration

    # 3. Fetch door model
    door_model_label = None
    door_model_id = None
    if config and config.door_model_id:
        door_model_id = config.door_model_id
        model_result = await db.execute(
            select(DoorModel).where(DoorModel.id == config.door_model_id)
        )
        model = model_result.scalar_one_or_none()
        if model:
            door_model_label = model.label

    # 4. Fetch field definitions (is_print=True)
    field_result = await db.execute(
        select(DoorFieldDefinition)
        .where(
            DoorFieldDefinition.is_print.is_(True),
            DoorFieldDefinition.is_active.is_(True),
        )
        .order_by(
            DoorFieldDefinition.print_order.asc().nulls_last(),
            DoorFieldDefinition.sort_order.asc(),
        )
    )
    field_defs = list(field_result.scalars().all())

    # 5. Resolve core configuration fields
    config_values = config.values if config else {}
    groups_dict: dict[str, list[PrintFieldValueSchema]] = {}

    for fd in field_defs:
        if fd.layer != "core":
            continue
        raw = config_values.get(fd.code)
        if raw is None:
            continue
        resolved = _resolve_field_value(fd, raw)
        if not resolved:
            continue

        fv = PrintFieldValueSchema(
            field_code=fd.code,
            field_label=fd.label_short or fd.label,
            field_value=resolved,
            unit=fd.unit,
            group_code=fd.group_code,
            group_label=fd.group_label,
        )

        key = fd.group_code
        if key not in groups_dict:
            groups_dict[key] = []
        groups_dict[key].append(fv)

    # Build sorted field groups
    group_order = {}
    for fd in field_defs:
        if fd.group_code not in group_order:
            group_order[fd.group_code] = fd.sort_order

    field_groups = [
        PrintFieldGroupSchema(
            group_code=gc,
            group_label=fields[0].group_label if fields else gc,
            fields=fields,
        )
        for gc, fields in sorted(groups_dict.items(), key=lambda x: group_order.get(x[0], 999))
    ]

    # 6. Resolve variant fields
    variant_fields: list[PrintFieldValueSchema] = []
    variant_values = item.variant_values or {}
    for fd in field_defs:
        if fd.layer != "variant":
            continue
        raw = variant_values.get(fd.code)
        if raw is None:
            continue
        resolved = _resolve_field_value(fd, raw)
        if not resolved:
            continue
        variant_fields.append(PrintFieldValueSchema(
            field_code=fd.code,
            field_label=fd.label_short or fd.label,
            field_value=resolved,
            unit=fd.unit,
            group_code=fd.group_code,
            group_label=fd.group_label,
        ))

    # 7. Fetch route with workshop info and build phased progress
    route_stages: list[RouteStageForPrintSchema] = []
    route_total = 0
    route_current = 0

    if door_model_id:
        route_result = await db.execute(
            select(ProductionRoute)
            .where(ProductionRoute.door_model_id == door_model_id)
            .options(
                selectinload(ProductionRoute.stage),
                selectinload(ProductionRoute.workshop),
            )
            .order_by(ProductionRoute.phase, ProductionRoute.step_order)
        )
        route_steps = list(route_result.scalars().all())
        route_total = len(route_steps)

        # Fetch workshop progress for this door
        progress_result = await db.execute(
            select(DoorWorkshopProgress)
            .where(DoorWorkshopProgress.door_id == door_id)
            .options(selectinload(DoorWorkshopProgress.stage))
        )
        progress_entries = list(progress_result.scalars().all())
        # Map: (workshop_id, phase) → progress
        progress_map: dict[tuple, DoorWorkshopProgress] = {}
        for p in progress_entries:
            progress_map[(p.workshop_id, p.phase)] = p

        # Fetch stage history for this door
        history_result = await db.execute(
            select(DoorStageHistory.to_stage_id)
            .where(DoorStageHistory.door_id == door_id)
        )
        completed_stage_ids = {row[0] for row in history_result.all()}

        for i, step in enumerate(route_steps):
            is_current = False
            is_completed = False

            # Check via workshop progress if available
            prog_key = (step.workshop_id, step.phase) if step.workshop_id else None
            prog = progress_map.get(prog_key) if prog_key else None

            if prog and prog.current_stage_id == step.stage_id:
                is_current = True
            elif step.stage_id == door.current_stage_id and not prog:
                # Legacy fallback
                is_current = True

            if step.stage_id in completed_stage_ids and not is_current:
                is_completed = True

            if is_current:
                route_current = i + 1

            # Check if entire track is completed
            if prog and prog.status == "completed":
                is_completed = True
                is_current = False

            route_stages.append(RouteStageForPrintSchema(
                stage_name=step.stage.name if step.stage else f"Stage {step.step_order}",
                step_order=step.step_order,
                is_completed=is_completed,
                is_current=is_current,
                is_optional=step.is_optional,
                workshop_name=step.workshop.name if step.workshop else None,
                workshop_color=step.workshop.color if step.workshop else None,
                phase=step.phase,
            ))

    # Current stage name
    current_stage_name = None
    if door.current_stage_id:
        stage_result = await db.execute(
            select(ProductionStage.name).where(ProductionStage.id == door.current_stage_id)
        )
        current_stage_name = stage_result.scalar_one_or_none()

    return DoorPrintDataSchema(
        door_id=door.id,
        internal_number=door.internal_number,
        marking=door.marking,
        order_number=order.order_number,
        client_name=order.client_name,
        facility_name=order.facility_name,
        floor=door.floor,
        building_block=door.building_block,
        apartment_number=door.apartment_number,
        location_description=door.location_description,
        door_model_label=door_model_label,
        door_type=config.door_type.value if config else None,
        configuration_name=config.name if config else None,
        field_groups=field_groups,
        variant_fields=variant_fields,
        current_stage_name=current_stage_name,
        route_current_step=route_current,
        route_total_steps=route_total,
        route_stages=route_stages,
        priority=door.priority,
        item_notes=item.notes,
        door_notes=door.notes,
        print_date=datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M"),
    )


async def get_stage_print_data(
    db: AsyncSession,
    stage_id: uuid.UUID,
    *,
    limit: int = 100,
) -> StagePrintDataSchema:
    """Assemble print summary for all doors at a production stage."""

    # Fetch stage with workshop
    stage_result = await db.execute(
        select(ProductionStage)
        .where(ProductionStage.id == stage_id)
        .options(selectinload(ProductionStage.workshop))
    )
    stage = stage_result.scalar_one_or_none()
    if not stage:
        raise NotFoundException("Stage not found")

    # Fetch doors at this stage — check both legacy current_stage_id and workshop progress
    # Legacy query (doors with current_stage_id set directly)
    legacy_rows = (
        await db.execute(
            select(
                OrderDoor.internal_number,
                OrderDoor.marking,
                OrderDoor.priority,
                Order.order_number,
                DoorConfiguration.door_model_id,
                DoorConfiguration.values,
            )
            .join(OrderItem, OrderDoor.order_item_id == OrderItem.id)
            .join(Order, OrderItem.order_id == Order.id)
            .join(DoorConfiguration, OrderItem.configuration_id == DoorConfiguration.id)
            .where(
                OrderDoor.status == DoorStatus.in_production,
                OrderDoor.current_stage_id == stage_id,
            )
            .order_by(OrderDoor.priority.desc(), OrderDoor.created_at)
            .limit(limit)
        )
    ).all()

    # Workshop progress query (doors where workshop progress points to this stage)
    progress_rows = (
        await db.execute(
            select(
                OrderDoor.internal_number,
                OrderDoor.marking,
                OrderDoor.priority,
                Order.order_number,
                DoorConfiguration.door_model_id,
                DoorConfiguration.values,
            )
            .join(OrderItem, OrderDoor.order_item_id == OrderItem.id)
            .join(Order, OrderItem.order_id == Order.id)
            .join(DoorConfiguration, OrderItem.configuration_id == DoorConfiguration.id)
            .join(
                DoorWorkshopProgress,
                DoorWorkshopProgress.door_id == OrderDoor.id,
            )
            .where(
                OrderDoor.status == DoorStatus.in_production,
                DoorWorkshopProgress.current_stage_id == stage_id,
                DoorWorkshopProgress.status == "active",
            )
            .order_by(OrderDoor.priority.desc(), OrderDoor.created_at)
            .limit(limit)
        )
    ).all()

    # Merge and deduplicate by internal_number
    seen = set()
    all_rows = []
    for row in progress_rows:
        if row.internal_number not in seen:
            seen.add(row.internal_number)
            all_rows.append(row)
    for row in legacy_rows:
        if row.internal_number not in seen:
            seen.add(row.internal_number)
            all_rows.append(row)

    # Fetch model labels in batch
    model_ids = {r.door_model_id for r in all_rows if r.door_model_id}
    model_labels: dict[uuid.UUID, str] = {}
    if model_ids:
        models_result = await db.execute(
            select(DoorModel.id, DoorModel.label).where(DoorModel.id.in_(model_ids))
        )
        model_labels = {row.id: row.label for row in models_result.all()}

    doors: list[StagePrintDoorSchema] = []
    for row in all_rows:
        config_vals = row.values or {}
        height = config_vals.get("height") or config_vals.get("height_mm")
        width = config_vals.get("width") or config_vals.get("width_mm")

        doors.append(StagePrintDoorSchema(
            internal_number=row.internal_number,
            marking=row.marking,
            order_number=row.order_number,
            door_model_label=model_labels.get(row.door_model_id) if row.door_model_id else None,
            height=str(height) if height else None,
            width=str(width) if width else None,
            priority=row.priority,
        ))

    return StagePrintDataSchema(
        stage_name=stage.name,
        stage_code=stage.code,
        workshop_name=stage.workshop.name if stage.workshop else None,
        print_date=datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M"),
        total_doors=len(doors),
        doors=doors,
    )
