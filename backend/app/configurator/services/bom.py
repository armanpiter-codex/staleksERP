"""BOM service — safe formula evaluator and BOM (Bill of Materials) calculation."""
import ast
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.exceptions import BadRequestException
from app.configurator.models import MaterialNorm
from app.configurator.schemas import BOMLineSchema, BOMSchema
from app.configurator.services.configurations import get_configuration


# ─── Safe Formula Evaluator ───────────────────────────────────────────────────

class _SafeFormulaVisitor(ast.NodeVisitor):
    """AST visitor — разрешает только арифметические операции и переменные height/width/quantity."""
    ALLOWED_NAMES = {"height", "width", "quantity"}

    def visit_Name(self, node: ast.Name) -> None:
        if node.id not in self.ALLOWED_NAMES:
            raise ValueError(f"Недопустимая переменная в формуле: '{node.id}'")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        raise ValueError("Вызовы функций в формулах запрещены")

    def visit_Attribute(self, node: ast.Attribute) -> None:
        raise ValueError("Обращения к атрибутам в формулах запрещены")

    def visit_Import(self, node: ast.Import) -> None:
        raise ValueError("Импорт в формулах запрещён")


def safe_eval_formula(formula: str, height: float, width: float, quantity: int) -> float:
    """Безопасное вычисление формулы расхода материала.

    Разрешённые операции: +, -, *, /, **, ()
    Разрешённые переменные: height, width, quantity
    """
    try:
        tree = ast.parse(formula, mode="eval")
        _SafeFormulaVisitor().visit(tree)
        result = eval(  # noqa: S307 — после AST-проверки безопасно
            compile(tree, "<formula>", "eval"),
            {"__builtins__": {}},
            {"height": height, "width": width, "quantity": quantity},
        )
        return float(result)
    except (ValueError, SyntaxError, ZeroDivisionError) as e:
        raise BadRequestException(f"Ошибка в формуле '{formula}': {e}") from e


# ─── BOM Engine ───────────────────────────────────────────────────────────────

async def calculate_bom(
    db: AsyncSession,
    config_id: uuid.UUID,
    variant_values: dict[str, Any] | None = None,
) -> BOMSchema:
    """Расчёт BOM (расход материалов) по нормам и параметрам двери.

    Мержит core values конфигурации с variant values (если переданы).
    """
    config = await get_configuration(db, config_id)

    merged_values = dict(config.values) if config.values else {}
    if variant_values:
        merged_values.update(variant_values)

    try:
        height = float(merged_values.get("height", 2050))
        width = float(merged_values.get("width", 860))
    except (TypeError, ValueError):
        height, width = 2050.0, 860.0

    field_codes = list(merged_values.keys())
    result = await db.execute(
        select(MaterialNorm).where(MaterialNorm.field_code.in_(field_codes))
    )
    all_norms = result.scalars().all()

    norms_index: dict[tuple[str, str], list[MaterialNorm]] = {}
    for norm in all_norms:
        key = (norm.field_code, norm.field_value)
        norms_index.setdefault(key, []).append(norm)

    bom_lines: list[BOMLineSchema] = []
    for field_code, field_value in merged_values.items():
        key = (field_code, str(field_value))
        for norm in norms_index.get(key, []):
            qty_per_door = safe_eval_formula(
                norm.quantity_formula, height, width, config.quantity
            )
            bom_lines.append(BOMLineSchema(
                material_name=norm.material_name,
                material_code=norm.material_code,
                unit=norm.unit,
                quantity_per_door=round(qty_per_door, 4),
                quantity_total=round(qty_per_door * config.quantity, 4),
            ))

    return BOMSchema(
        configuration_id=config.id,
        door_quantity=config.quantity,
        lines=bom_lines,
    )
