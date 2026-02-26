"""Orders service — делегирует в services/ sub-package.

Router импортирует этот модуль как `from app.orders import service`.
Все вызовы вида `service.get_order(...)` продолжают работать без изменений.
"""
from app.orders.services.crud import (
    create_order,
    delete_order,
    get_order,
    get_orders,
    update_order,
)
from app.orders.services.doors import (
    _find_door_in_order,
    apply_markings,
    batch_transition_door_status,
    delete_door,
    generate_doors,
    toggle_door_priority,
    transition_door_status,
    update_door,
)
from app.orders.services.items import add_item, remove_item, update_item
from app.orders.services.pricing import get_order_summary
from app.orders.services.workflow import transition_item_status, transition_order_status

__all__ = [
    "get_orders",
    "get_order",
    "create_order",
    "update_order",
    "delete_order",
    "transition_order_status",
    "transition_item_status",
    "add_item",
    "update_item",
    "remove_item",
    "generate_doors",
    "update_door",
    "transition_door_status",
    "batch_transition_door_status",
    "toggle_door_priority",
    "delete_door",
    "_find_door_in_order",
    "get_order_summary",
    "apply_markings",
]
