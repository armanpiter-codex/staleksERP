"""Configurator service — делегирует в services/ sub-package.

Router импортирует этот модуль как `from app.configurator import service`.
Все вызовы вида `service.get_configurations(...)` продолжают работать без изменений.
"""
from app.configurator.services.catalog import (
    create_field_definition,
    create_group,
    create_model,
    create_visibility_rule,
    delete_group,
    delete_model,
    delete_visibility_rule,
    get_all_field_definitions,
    get_all_groups,
    get_all_models,
    get_configurator_catalog,
    get_field_definition_by_code,
    get_group_by_code,
    get_model_by_code,
    get_visibility_rules,
    update_field_definition,
    update_group,
    update_model,
)
from app.configurator.services.configurations import (
    _recalculate_prices,
    bulk_import_markings,
    clear_markings,
    create_configuration,
    create_marking,
    delete_configuration,
    delete_marking,
    duplicate_configuration,
    generate_markings,
    get_configuration,
    get_configurations,
    get_markings,
    update_configuration,
    update_marking,
)
from app.configurator.services.pricing import (
    calculate_price,
    calculate_variant_price,
)
from app.configurator.services.bom import (
    calculate_bom,
    safe_eval_formula,
)
from app.configurator.services.rules import (
    create_material_norm,
    create_pricing_rule,
    delete_material_norm,
    delete_pricing_rule,
    get_material_norms,
    get_pricing_rules,
    update_pricing_rule,
)

__all__ = [
    # catalog
    "get_all_field_definitions",
    "get_field_definition_by_code",
    "create_field_definition",
    "update_field_definition",
    "get_visibility_rules",
    "create_visibility_rule",
    "delete_visibility_rule",
    "get_configurator_catalog",
    # models
    "get_all_models",
    "get_model_by_code",
    "create_model",
    "update_model",
    "delete_model",
    # groups
    "get_all_groups",
    "get_group_by_code",
    "create_group",
    "update_group",
    "delete_group",
    # configurations
    "get_configurations",
    "get_configuration",
    "create_configuration",
    "update_configuration",
    "duplicate_configuration",
    "delete_configuration",
    "_recalculate_prices",
    # markings
    "get_markings",
    "create_marking",
    "update_marking",
    "delete_marking",
    "generate_markings",
    "bulk_import_markings",
    "clear_markings",
    # pricing
    "calculate_price",
    "calculate_variant_price",
    # bom
    "calculate_bom",
    "safe_eval_formula",
    # rules
    "get_pricing_rules",
    "create_pricing_rule",
    "update_pricing_rule",
    "delete_pricing_rule",
    "get_material_norms",
    "create_material_norm",
    "delete_material_norm",
]
