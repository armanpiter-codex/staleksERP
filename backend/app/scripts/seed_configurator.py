"""
Seed script: door configurator fields, visibility rules, and sample pricing.

Run via: docker compose exec backend python -m app.scripts.seed_configurator

Поля конфигуратора описывают все параметры двери:
 - Технические (противопожарные, простые технические)
 - С Отделкой (квартирные, коттедж, дача)
"""
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.configurator.models import (
    DoorConfiguration,
    DoorFieldDefinition,
    DoorFieldGroup,
    DoorFieldVisibilityRule,
    DoorModel,
    FieldLayer,
)

settings = get_settings()

# ─────────────────────────────────────────────────────────────────────────────
# Группы полей
# ─────────────────────────────────────────────────────────────────────────────
G_GENERAL    = ("general",    "Общие параметры")
G_FRAME      = ("frame",      "Металл")
G_LEAF       = ("leaf",       "Полотно")
G_INSULATION = ("insulation", "Огнезащита")
G_LOCK       = ("lock",       "Замочная группа")
G_HANDLE     = ("handle",     "Фурнитура")
G_FINISH_EXT = ("finish_ext", "Наружная отделка")
G_FINISH_INT = ("finish_int", "Внутренняя отделка")
G_GLASS      = ("glass",      "Остекление / Фрамуга")
G_THRESHOLD  = ("threshold",  "Порог")
G_PRODUCTION = ("production", "Производство")

# ─────────────────────────────────────────────────────────────────────────────
# Типы применимости
# ─────────────────────────────────────────────────────────────────────────────
T  = ["technical"]
F  = ["finish"]
TF = ["technical", "finish"]


def opt(*pairs):
    """opt("val1","Метка 1", "val2","Метка 2") → [{"value":...,"label":...},...]"""
    it = iter(pairs)
    return [{"value": v, "label": l} for v, l in zip(it, it)]


# ─────────────────────────────────────────────────────────────────────────────
# Поля для деактивации (устаревшие, заменены новой схемой)
# ─────────────────────────────────────────────────────────────────────────────
FIELDS_TO_DEACTIVATE = [
    "door_type_sub", "opening_direction", "wall_thickness", "size_non_standard",
    "frame_type", "frame_color", "frame_seal", "frame_anchor",
    "leaf_thickness", "leaf_steel_thickness", "leaf_frame_profile", "leaf_ribs",
    "anti_removal_pins", "insulation_type", "fire_cert_required",
    "lock_count", "lock_additional", "handle_inside",
    "finish_ext_panel_design", "finish_int_panel_design",
    "glass_type", "glass_size", "glass_location", "glass_decorative_insert",
    "access_control", "doorbell_prep", "anti_condensate_heating", "protective_trim",
    "delivery_type", "installation_required", "quantity",
]

# ─────────────────────────────────────────────────────────────────────────────
# Определения полей (реальные данные из Excel)
# Формат: (code, label, label_short, field_type,
#           group_tuple, sort_order,
#           options|None, default_value|None,
#           is_required, door_type_applicability, unit|None, notes|None)
# ─────────────────────────────────────────────────────────────────────────────
FIELD_DEFS = [
    # ── Общие параметры ──────────────────────────────────────────────────────
    (
        "height", "Высота блока", "Высота", "number",
        G_GENERAL, 10,
        None, "2050", True, TF, "мм", None,
    ),
    (
        "width", "Ширина блока", "Ширина", "number",
        G_GENERAL, 20,
        None, "860", True, TF, "мм", None,
    ),
    (
        "num_wings", "Кол-во створок", "Створки", "select",
        G_GENERAL, 30,
        opt("1", "1 створка", "2", "2 створки"),
        "1", True, TF, None, None,
    ),
    (
        "wings_equal", "Створки одинаковые", "Одинак.", "select",
        G_GENERAL, 40,
        opt("yes", "Да", "no", "Нет"),
        "yes", False, TF, None, "Только если 2 створки",
    ),
    (
        "active_wing_width", "Ширина активной створки", "Акт. створка", "number",
        G_GENERAL, 50,
        None, None, False, TF, "мм", "Только если створки разные",
    ),
    (
        "seal_circuits", "Кол-во контуров уплотнения", "Контуры", "select",
        G_GENERAL, 55,
        opt("2", "2 контура", "3", "3 контура"),
        "2", True, T, None, None,
    ),
    (
        "opening_side", "Открывание", "Открывание", "select",
        G_GENERAL, 60,
        opt("right", "Правое", "left", "Левое", "other", "Другое"),
        "right", True, TF, None, None,
    ),
    (
        "opening_scheme", "Схема открывания", "Схема", "select",
        G_GENERAL, 65,
        opt(
            "A", "А", "B", "Б", "K", "К",
            "L", "L", "D", "Д", "C", "С", "F", "F", "E", "E",
        ),
        None, False, TF, None, "Только если открывание = Другое",
    ),

    # ── Металл (коробка / рама / наличники) ──────────────────────────────────
    (
        "metal_nalichnik", "Наличник (металл)", "Наличник", "select",
        G_FRAME, 10,
        opt("with", "С наличником", "without", "Без наличника", "other", "Другое"),
        "with", True, TF, None, None,
    ),
    (
        "nalichnik_choice", "Выбор наличника", "Вариант нал.", "select",
        G_FRAME, 20,
        opt(
            "no_lock_side",  "Замочная сторона без нал.",
            "no_hinge_side", "Шарнирная сторона без нал.",
            "no_top",        "Верх без нал.",
            "only_top",      "Нал. только сверху",
        ),
        None, False, TF, None, "Только если Другое",
    ),
    (
        "metal_thickness", "Толщина металла", "Толщина", "select",
        G_FRAME, 30,
        opt("standard", "Стандарт", "other", "Другое"),
        "standard", True, TF, None, None,
    ),
    (
        "frame_thick_cond", "Толщина короба", "Короб мм", "select",
        G_FRAME, 40,
        opt("1.5", "1,5 мм", "1.2", "1,2 мм", "1.0", "1 мм"),
        None, False, TF, "мм", "Только если толщина = Другое",
    ),

    # ── Полотно ───────────────────────────────────────────────────────────────
    (
        "outer_steel_cond", "Толщина наружной стали", "Нар. сталь", "select",
        G_LEAF, 10,
        opt("1.5", "1,5 мм", "1.2", "1,2 мм", "1.0", "1 мм"),
        None, False, TF, "мм", "Только если толщина = Другое",
    ),
    (
        "inner_steel_cond", "Толщина внутренней стали", "Вн. сталь", "select",
        G_LEAF, 20,
        opt("1.5", "1,5 мм", "1.2", "1,2 мм", "1.0", "1 мм", "none", "Нет"),
        None, False, TF, "мм", "Только если толщина = Другое",
    ),
    (
        "hinge_type", "Петли", "Петли", "select",
        G_LEAF, 30,
        opt(
            "2",        "2 петли",
            "3",        "3 петли",
            "2_hidden", "2 петли скрытые",
            "3_hidden", "3 петли скрытые",
        ),
        "3", True, TF, None, None,
    ),
    (
        "extra_hinge", "Доп. шарнир", "Доп. шарнир", "select",
        G_LEAF, 40,
        opt("yes", "Есть", "no", "Нет"),
        "no", False, TF, None, None,
    ),

    # ── Огнезащита ────────────────────────────────────────────────────────────
    (
        "fire_resistance_class", "Противопожарность", "Класс ОС", "select",
        G_INSULATION, 10,
        opt("none", "Нет", "ei30", "Ei-30", "ei60", "Ei-60"),
        "none", True, T, None, None,
    ),

    # ── Замочная группа ───────────────────────────────────────────────────────
    (
        "lock_technical", "Замок", "Замок", "select",
        G_LOCK, 10,
        opt(
            "doorlock",     "DoorLock",
            "kale_152",     "Kale 152",
            "iseo",         "ISEO",
            "iseo_panic_1", "ISEO с антипаникой на 1 ств",
            "iseo_panic_2", "ISEO с антипаникой на 2 ств",
        ),
        "kale_152", True, T, None, None,
    ),
    (
        "lock_name_custom_technical", "Название замка (тех.)", "Замок (арт.)", "text",
        G_LOCK, 15,
        None, None, False, T, None, "Уточните марку и артикул",
    ),
    (
        "zadvizhka", "Задвижка", "Задвижка", "select",
        G_LOCK, 20,
        opt(
            "standard",  "Стандарт",
            "edge",      "Торцевая",
            "exterior",  "С наружной стороны",
        ),
        "standard", False, TF, None, "Только если 2 створки",
    ),
    (
        "lock_apartment", "Замок", "Замок", "select",
        G_LOCK, 10,
        opt(
            "kale_252_257", "Kale 252+257",
            "guardian",     "Guardian 32.11+30.01",
            "cisa",         "Cisa",
            "kale_252",     "Kale 252",
            "guardian_32",  "Guardian 32.11",
            "other",        "Другое",
        ),
        "kale_252_257", True, F, None, None,
    ),
    (
        "lock_name_custom_apartment", "Название замка", "Замок (арт.)", "text",
        G_LOCK, 15,
        None, None, False, F, None, "Заполните если выбрали 'Другое'",
    ),
    (
        "cylinder", "Цилиндр", "Цилиндр", "select",
        G_LOCK, 30,
        opt("key_key", "Ключ-ключ", "key_knob", "Ключ-поворотник"),
        "key_key", True, F, None, None,
    ),
    (
        "nightlatch", "Ночник", "Ночник", "select",
        G_LOCK, 40,
        opt("yes", "Есть", "no", "Нет"),
        "no", False, F, None, None,
    ),

    # ── Фурнитура ─────────────────────────────────────────────────────────────
    (
        "handle_type", "Фурнитура / Ручка", "Ручка", "text",
        G_HANDLE, 10,
        None, None, False, TF, None, None,
    ),
    (
        "door_closer", "Доводчик", "Доводчик", "select",
        G_HANDLE, 30,
        opt("no", "Нет", "wing_1", "На 1 ств", "wing_2", "На 2 ств"),
        "no", False, TF, None, None,
    ),
    (
        "door_viewer", "Глазок", "Глазок", "select",
        G_HANDLE, 40,
        opt("black", "Черный", "chrome", "Хром", "gold", "Золото", "no", "Нет"),
        "no", False, F, None, None,
    ),

    # ── Наружная отделка ──────────────────────────────────────────────────────
    # Технические: просто цвет окраски металла
    (
        "metal_color", "Цвет", "Цвет", "text",
        G_FINISH_EXT, 10,
        None, None, True, T, None, "Цвет окраски металла (RAL или описание)",
    ),
    # Квартирки: накладка + детали
    (
        "finish_ext_type", "Наружная накладка", "Накладка (нар.)", "select",
        G_FINISH_EXT, 10,
        opt(
            "pvc",         "ПВХ",
            "paint",       "Покраска",
            "veneer_paint","Шпон+покраска",
            "veneer_tint", "Шпон+тонировка",
        ),
        "pvc", True, F, None, None,
    ),
    (
        "finish_ext_thickness", "Толщина накладки (нар.)", "Толщ. (нар.)", "select",
        G_FINISH_EXT, 20,
        opt("16", "16 мм", "12", "12 мм", "10", "10 мм"),
        "16", True, F, "мм", None,
    ),
    (
        "finish_ext_raster", "Рисунок (нар.)", "Рисунок", "text",
        G_FINISH_EXT, 30,
        None, None, False, F, None, None,
    ),
    (
        "finish_ext_color", "Цвет (нар.)", "Цвет (нар.)", "text",
        G_FINISH_EXT, 40,
        None, None, False, F, None, None,
    ),
    (
        "mdf_insert", "Вставка МДФ", "Вст. МДФ", "text",
        G_FINISH_EXT, 50,
        None, None, False, F, None, None,
    ),
    (
        "metal_insert", "Вставка металл", "Вст. металл", "text",
        G_FINISH_EXT, 60,
        None, None, False, F, None, None,
    ),
    (
        "corona", "Корона", "Корона", "text",
        G_FINISH_EXT, 70,
        None, None, False, F, None, None,
    ),
    (
        "decorative_detail", "Декоративный элемент", "Декор", "text",
        G_FINISH_EXT, 80,
        None, None, False, F, None, None,
    ),
    (
        "patina_ext", "Патина (нар.)", "Патина (нар.)", "text",
        G_FINISH_EXT, 90,
        None, None, False, F, None, None,
    ),
    (
        "mdf_nalichnik", "Наличник МДФ", "Нал. МДФ", "select",
        G_FINISH_EXT, 100,
        opt(
            "no",            "Нет",
            "full",          "Есть (полный)",
            "vertical_only", "Только вертикальные",
            "no_lock_side",  "Замочная сторона без нал.",
            "no_hinge_side", "Шарнирная сторона без нал.",
        ),
        "no", False, F, None, None,
    ),
    (
        "nalichnik_color", "Цвет наличников", "Цвет нал.", "text",
        G_FINISH_EXT, 110,
        None, None, False, F, None, None,
    ),
    (
        "nalichnik_desc", "Описание наличников", "Описание нал.", "text",
        G_FINISH_EXT, 120,
        None, None, False, F, None, None,
    ),

    # ── Внутренняя отделка ────────────────────────────────────────────────────
    (
        "finish_int_type", "Внутренняя накладка", "Накладка (вн.)", "select",
        G_FINISH_INT, 10,
        opt(
            "pvc",         "ПВХ",
            "paint",       "Покраска",
            "veneer_paint","Шпон+покраска",
            "veneer_tint", "Шпон+тонировка",
        ),
        "pvc", True, F, None, None,
    ),
    (
        "finish_int_thickness", "Толщина накладки (вн.)", "Толщ. (вн.)", "select",
        G_FINISH_INT, 20,
        opt("16", "16 мм", "12", "12 мм", "10", "10 мм", "8", "8 мм"),
        "16", True, F, "мм", None,
    ),
    (
        "finish_int_raster", "Рисунок (вн.)", "Рисунок", "text",
        G_FINISH_INT, 30,
        None, None, False, F, None, None,
    ),
    (
        "finish_int_color", "Цвет (вн.)", "Цвет (вн.)", "text",
        G_FINISH_INT, 40,
        None, None, False, F, None, None,
    ),
    (
        "patina_int", "Патина (вн.)", "Патина (вн.)", "text",
        G_FINISH_INT, 50,
        None, None, False, F, None, None,
    ),

    # ── Остекление / Фрамуга ─────────────────────────────────────────────────
    (
        "vent_grid", "Вент решетка", "Вент решетка", "text",
        G_GLASS, 10,
        None, None, False, TF, None, "Размеры/тип вентиляционной решетки",
    ),
    (
        "steklopaket_tech", "Стеклопакет", "Стеклопакет", "text",
        G_GLASS, 20,
        None, None, False, T, None, "Размеры стеклопакета (напр. 300×400 мм)",
    ),
    (
        "framuga", "Фрамуга", "Фрамуга", "select",
        G_GLASS, 30,
        opt("blind", "Глухая", "glazed", "Остекленная", "false_framuga", "Фальш-фрамуга"),
        None, False, TF, None, None,
    ),
    (
        "steklopaket_h", "Стеклопакет (высота)", "Стекл. H", "number",
        G_GLASS, 40,
        None, None, False, F, "мм", None,
    ),
    (
        "steklopaket_w", "Стеклопакет (ширина)", "Стекл. W", "number",
        G_GLASS, 50,
        None, None, False, F, "мм", None,
    ),

    # ── Порог ─────────────────────────────────────────────────────────────────
    (
        "threshold_type", "Порог", "Порог", "select",
        G_THRESHOLD, 10,
        opt(
            "standard_55",  "Стандарт 55мм",
            "low_30",       "Заниженный 30мм",
            "low_16",       "Заниженный 16мм",
            "no_threshold", "Без порога",
            "drop_down",    "Выпадающий",
            "brush",        "Щетка с резиновой рейкой",
        ),
        "standard_55", True, TF, None, None,
    ),

    # ── Производство ──────────────────────────────────────────────────────────
    (
        "hard_packaging", "Жесткая упаковка", "Упаковка", "select",
        G_PRODUCTION, 5,
        opt("yes", "Есть", "no", "Нет"),
        "no", False, TF, None, None,
    ),
    (
        "workshop_priority", "Приоритет производства", "Приоритет", "select",
        G_PRODUCTION, 10,
        opt("normal", "Обычный", "high", "Высокий", "urgent", "Срочный"),
        "normal", False, TF, None, None,
    ),
    (
        "special_notes", "Особые требования", "Прим.", "text",
        G_PRODUCTION, 20,
        None, None, False, TF, None, "Особые условия, согласованные с бригадиром",
    ),
]

# ─────────────────────────────────────────────────────────────────────────────
# Variant поля — эстетические параметры, выбираемые при заказе
# ─────────────────────────────────────────────────────────────────────────────
VARIANT_FIELDS = {
    "finish_ext_type", "finish_ext_color", "finish_ext_thickness",
    "finish_int_type", "finish_int_color", "finish_int_thickness",
    "finish_ext_raster", "finish_int_raster",
    "metal_color",
    "patina_ext", "patina_int",
    "nalichnik_color",
    "handle_type",
    "door_viewer",
    "cylinder",
    "hinge_type",
}

# ─────────────────────────────────────────────────────────────────────────────
# Правила видимости
# Формат: (field_code, depends_on_field_code, depends_on_value_list, rule_type)
# ─────────────────────────────────────────────────────────────────────────────
VISIBILITY_RULES = [
    # Двустворчатые
    ("wings_equal",      "num_wings",       ["2"],       "show_when"),
    ("active_wing_width","wings_equal",     ["no"],      "show_when"),
    ("zadvizhka",        "num_wings",       ["2"],       "show_when"),

    # Нестандартное открывание
    ("opening_scheme",   "opening_side",    ["other"],   "show_when"),

    # Нестандартная толщина металла
    ("frame_thick_cond", "metal_thickness", ["other"],   "show_when"),
    ("outer_steel_cond", "metal_thickness", ["other"],   "show_when"),
    ("inner_steel_cond", "metal_thickness", ["other"],   "show_when"),

    # Выбор варианта наличника
    ("nalichnik_choice", "metal_nalichnik", ["other"],   "show_when"),

    # Замок квартирный — уточнение если другой
    ("lock_name_custom_apartment", "lock_apartment", ["other"], "show_when"),
]


# ─────────────────────────────────────────────────────────────────────────────
# seed_fields — полный upsert с деактивацией устаревших
# ─────────────────────────────────────────────────────────────────────────────
async def seed_fields(db: AsyncSession) -> None:
    from sqlalchemy import update as sa_update

    print("Seeding door field definitions...")

    # Step 1: деактивируем устаревшие поля
    for code in FIELDS_TO_DEACTIVATE:
        await db.execute(
            sa_update(DoorFieldDefinition)
            .where(DoorFieldDefinition.code == code)
            .values(is_active=False)
        )
    print(f"  Deactivated {len(FIELDS_TO_DEACTIVATE)} obsolete fields")

    # Step 2: upsert активных полей
    for item in FIELD_DEFS:
        (
            code, label, label_short, field_type,
            group_tuple, sort_order,
            options, default_value,
            is_required, door_type_applicability, unit, notes,
        ) = item

        group_code, group_label = group_tuple
        layer = FieldLayer.variant if code in VARIANT_FIELDS else FieldLayer.core

        result = await db.execute(
            select(DoorFieldDefinition).where(DoorFieldDefinition.code == code)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.label                  = label
            existing.label_short            = label_short
            existing.field_type             = field_type
            existing.group_code             = group_code
            existing.group_label            = group_label
            existing.sort_order             = sort_order
            existing.options                = options
            existing.default_value          = default_value
            existing.is_required            = is_required
            existing.door_type_applicability = door_type_applicability
            existing.layer                  = layer
            existing.unit                   = unit
            existing.notes                  = notes
            existing.is_active              = True
            print(f"  ~ field updated: {code}")
        else:
            obj = DoorFieldDefinition(
                code=code,
                label=label,
                label_short=label_short,
                field_type=field_type,
                group_code=group_code,
                group_label=group_label,
                sort_order=sort_order,
                options=options,
                default_value=default_value,
                is_required=is_required,
                door_type_applicability=door_type_applicability,
                layer=layer,
                unit=unit,
                notes=notes,
                is_active=True,
            )
            db.add(obj)
            print(f"  + field: {code} (layer={layer.value})")

    await db.flush()
    print(f"  Fields done: {len(FIELD_DEFS)} active fields")


async def seed_visibility_rules(db: AsyncSession) -> None:
    from sqlalchemy import delete
    print("Seeding visibility rules...")

    await db.execute(delete(DoorFieldVisibilityRule))

    for field_code, depends_on, depends_val, rule_type in VISIBILITY_RULES:
        result = await db.execute(
            select(DoorFieldDefinition).where(DoorFieldDefinition.code == field_code)
        )
        if not result.scalar_one_or_none():
            print(f"  ! SKIP rule for unknown field: {field_code}")
            continue

        obj = DoorFieldVisibilityRule(
            field_code=field_code,
            depends_on_field_code=depends_on,
            depends_on_value=depends_val if isinstance(depends_val, list) else [depends_val],
            rule_type=rule_type,
        )
        db.add(obj)
        print(f"  + rule: {field_code} ({rule_type}) ← {depends_on}={depends_val}")

    await db.flush()
    print(f"  Rules done: {len(VISIBILITY_RULES)} total")


# ─────────────────────────────────────────────────────────────────────────────
# Шаблоны конфигураций (core templates) — обновлены под новые field codes
# ─────────────────────────────────────────────────────────────────────────────
CORE_TEMPLATES = [
    {
        "name": "ДМП EI30 стандарт",
        "door_type": "technical",
        "values": {
            "height": "2050",
            "width": "860",
            "num_wings": "1",
            "seal_circuits": "3",
            "opening_side": "left",
            "metal_nalichnik": "with",
            "metal_thickness": "standard",
            "hinge_type": "3",
            "fire_resistance_class": "ei30",
            "lock_technical": "kale_152",
            "door_closer": "wing_1",
            "metal_color": "RAL 7024",
            "threshold_type": "standard_55",
            "hard_packaging": "no",
            "workshop_priority": "normal",
        },
    },
    {
        "name": "ДМП EI60 стандарт",
        "door_type": "technical",
        "values": {
            "height": "2050",
            "width": "860",
            "num_wings": "1",
            "seal_circuits": "3",
            "opening_side": "left",
            "metal_nalichnik": "with",
            "metal_thickness": "standard",
            "hinge_type": "3",
            "fire_resistance_class": "ei60",
            "lock_technical": "iseo",
            "door_closer": "wing_1",
            "metal_color": "RAL 7024",
            "threshold_type": "standard_55",
            "hard_packaging": "no",
            "workshop_priority": "normal",
        },
    },
    {
        "name": "Квартирная стандарт",
        "door_type": "finish",
        "values": {
            "height": "2050",
            "width": "960",
            "num_wings": "1",
            "opening_side": "left",
            "metal_nalichnik": "with",
            "metal_thickness": "standard",
            "hinge_type": "3",
            "lock_apartment": "kale_252_257",
            "cylinder": "key_key",
            "nightlatch": "no",
            "door_viewer": "chrome",
            "finish_ext_type": "pvc",
            "finish_ext_thickness": "16",
            "finish_int_type": "pvc",
            "finish_int_thickness": "16",
            "mdf_nalichnik": "full",
            "threshold_type": "low_30",
            "hard_packaging": "no",
            "workshop_priority": "normal",
        },
    },
]


async def seed_templates(db: AsyncSession) -> None:
    """Создание/обновление core-шаблонов конфигураций."""
    print("Seeding core templates...")

    from app.auth.models import User
    result = await db.execute(select(User).where(User.username == "owner"))
    owner = result.scalar_one_or_none()
    if not owner:
        print("  ! Owner user not found — skip templates")
        return

    for tpl_data in CORE_TEMPLATES:
        result = await db.execute(
            select(DoorConfiguration).where(
                DoorConfiguration.name == tpl_data["name"],
                DoorConfiguration.is_template.is_(True),
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.values    = tpl_data["values"]
            existing.door_type = tpl_data["door_type"]
            print(f"  ~ template updated: {tpl_data['name']}")
        else:
            obj = DoorConfiguration(
                name=tpl_data["name"],
                door_type=tpl_data["door_type"],
                values=tpl_data["values"],
                quantity=1,
                is_template=True,
                created_by=owner.id,
            )
            db.add(obj)
            print(f"  + template: {tpl_data['name']}")

    await db.flush()
    print(f"  Templates done: {len(CORE_TEMPLATES)} total")


# ─────────────────────────────────────────────────────────────────────────────
# Модели дверей
# ─────────────────────────────────────────────────────────────────────────────
DOOR_MODELS_DATA = [
    ("tech_standard", "Техническая",            "Техн.",  "technical", 10, False),
    ("fire_ei30",     "Противопожарная Ei-30",   "Ei-30",  "technical", 20, False),
    ("fire_ei60",     "Противопожарная Ei-60",   "Ei-60",  "technical", 30, False),
    ("fire_ei90",     "Противопожарная Ei-90",   "Ei-90",  "technical", 40, False),
    ("premium",       "Премиум",                 "Прем.",  "technical", 50, False),
    ("galant",        "Галант",                  "Гал.",   "finish",    10, True),
    ("modena",        "Модена",                  "Мод.",   "finish",    20, True),
    ("elite",         "Элит",                    "Эл.",    "finish",    30, False),
    ("venezia",       "Венеция",                 "Вен.",   "finish",    40, False),
    ("palermo",       "Палермо",                 "Пал.",   "finish",    50, False),
    ("vinorit",       "Винорит",                 "Вин.",   "finish",    60, False),
]

# ─────────────────────────────────────────────────────────────────────────────
# Группы полей (display) — обновлены метки
# ─────────────────────────────────────────────────────────────────────────────
DOOR_GROUPS_DATA = [
    ("general",    "Общие параметры",       10, ["technical", "finish"]),
    ("frame",      "Металл",                20, ["technical", "finish"]),
    ("leaf",       "Полотно",               30, ["technical", "finish"]),
    ("insulation", "Огнезащита",            40, ["technical"]),
    ("lock",       "Замочная группа",       50, ["technical", "finish"]),
    ("handle",     "Фурнитура",             60, ["technical", "finish"]),
    ("finish_ext", "Наружная отделка",      70, ["technical", "finish"]),
    ("finish_int", "Внутренняя отделка",    80, ["finish"]),
    ("glass",      "Остекление / Фрамуга",  90, ["technical", "finish"]),
    ("threshold",  "Порог",                100, ["technical", "finish"]),
    ("production", "Производство",         110, ["technical", "finish"]),
]


async def seed_models(db: AsyncSession) -> None:
    print("Seeding door models...")
    for code, label, label_short, door_type, sort_order, no_exterior in DOOR_MODELS_DATA:
        result = await db.execute(select(DoorModel).where(DoorModel.code == code))
        if result.scalar_one_or_none():
            print(f"  ~ model exists: {code}")
            continue
        obj = DoorModel(
            code=code, label=label, label_short=label_short,
            door_type=door_type, sort_order=sort_order, no_exterior=no_exterior,
        )
        db.add(obj)
        print(f"  + model: {code}")
    await db.flush()
    print(f"  Models done: {len(DOOR_MODELS_DATA)} total")


async def seed_groups(db: AsyncSession) -> None:
    print("Seeding door field groups...")
    for code, label, sort_order, applicability in DOOR_GROUPS_DATA:
        result = await db.execute(select(DoorFieldGroup).where(DoorFieldGroup.code == code))
        existing = result.scalar_one_or_none()
        if existing:
            existing.label                  = label
            existing.sort_order             = sort_order
            existing.door_type_applicability = applicability
            print(f"  ~ group updated: {code} -> '{label}'")
        else:
            obj = DoorFieldGroup(
                code=code, label=label, sort_order=sort_order,
                door_type_applicability=applicability,
            )
            db.add(obj)
            print(f"  + group: {code}")
    await db.flush()
    print(f"  Groups done: {len(DOOR_GROUPS_DATA)} total")


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        await seed_models(session)
        await seed_groups(session)
        await seed_fields(session)
        await seed_visibility_rules(session)
        await seed_templates(session)
        await session.commit()
        print("\nConfigurator seed complete!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
