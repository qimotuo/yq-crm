"""数据权限 — 按角色 dataScope 过滤行级数据"""

from app.core.exceptions import BizError
from app.db.models import User


def get_data_scope(perms: dict) -> str:
    return perms.get("dataScope") or "SELF"


def is_super_operations(perms: dict) -> bool:
    return "*" in (perms.get("operations") or [])


def is_all_data_scope(perms: dict) -> bool:
    return is_super_operations(perms) or get_data_scope(perms) == "ALL"


def resolve_sales_filter(perms: dict, user: User, sales_name: str = "") -> str:
    """SELF 强制本人；ALL 可用传入 salesName 筛选"""
    if is_all_data_scope(perms):
        return sales_name
    if get_data_scope(perms) == "SELF":
        return user.name
    return sales_name


def filter_work_orders(items: list[dict], user: User, perms: dict) -> list[dict]:
    if is_all_data_scope(perms):
        return items
    scope = get_data_scope(perms)
    if scope == "SELF":
        return [o for o in items if o.get("salesName") == user.name]
    if scope == "ASSIGNED":
        return [o for o in items if o.get("installer") == user.name]
    return items


def assert_work_order_access(order: dict, user: User, perms: dict) -> None:
    if can_access_work_order(order, user, perms):
        return
    raise BizError("无权访问该工单", 403)


def can_access_work_order(order: dict, user: User, perms: dict) -> bool:
    if is_all_data_scope(perms):
        return True
    scope = get_data_scope(perms)
    if scope == "SELF":
        return order.get("salesName") == user.name
    if scope == "ASSIGNED":
        return order.get("installer") == user.name
    return True


def can_override_installation_edit(perms: dict) -> bool:
    return is_super_operations(perms)
