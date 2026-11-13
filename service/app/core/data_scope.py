"""数据权限 — 按角色 dataScope 过滤行级数据

ALL      全部数据
SELF     仅本人（销售名 / 安装员名 / user_id）
ASSIGNED 仅分配给自己的工单（installer）
DEPT     本部门：同 dept_code 用户名下的客户/工单/跟进/日程
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import User

# 预置部门（用户可任选；空表示未分配部门，DEPT 时仅能看本人）
DEPARTMENTS = [
    {"code": "sales", "name": "销售部"},
    {"code": "ops", "name": "运维部"},
    {"code": "finance", "name": "财务部"},
    {"code": "warehouse", "name": "仓储部"},
    {"code": "admin", "name": "行政部"},
]


def get_data_scope(perms: dict) -> str:
    return perms.get("dataScope") or "SELF"


def is_super_operations(perms: dict) -> bool:
    return "*" in (perms.get("operations") or [])


def is_all_data_scope(perms: dict) -> bool:
    return is_super_operations(perms) or get_data_scope(perms) == "ALL"


def list_dept_member_names(db: Session, user: User) -> list[str]:
    """同部门启用用户的真实姓名列表；无部门时仅本人。"""
    dept = (user.dept_code or "").strip()
    if not dept:
        return [user.name] if user.name else []
    rows = (
        db.query(User.name)
        .filter(User.enabled.is_(True), User.dept_code == dept)
        .all()
    )
    names = [r[0] for r in rows if r[0]]
    if user.name and user.name not in names:
        names.append(user.name)
    return names


def list_dept_member_ids(db: Session, user: User) -> list[int]:
    dept = (user.dept_code or "").strip()
    if not dept:
        return [user.id]
    rows = (
        db.query(User.id)
        .filter(User.enabled.is_(True), User.dept_code == dept)
        .all()
    )
    ids = [r[0] for r in rows]
    if user.id not in ids:
        ids.append(user.id)
    return ids


def resolve_sales_filter(perms: dict, user: User, sales_name: str = "") -> str:
    """兼容旧接口：SELF 强制本人；ALL 可用传入筛选；DEPT 请用 resolve_sales_names。"""
    if is_all_data_scope(perms):
        return sales_name
    if get_data_scope(perms) == "SELF":
        return user.name
    if get_data_scope(perms) == "DEPT":
        return sales_name or user.name
    return sales_name


def resolve_sales_names(
    db: Session,
    perms: dict,
    user: User,
    sales_name: str = "",
) -> list[str] | None:
    """客户/跟进过滤用。

    返回 None：不按归属限制（ALL，可用 sales_name 做模糊）
    返回 list：sales_name IN list（空 list 表示无数据）
    """
    if is_all_data_scope(perms):
        return None
    scope = get_data_scope(perms)
    if scope == "SELF":
        return [user.name]
    if scope == "DEPT":
        names = list_dept_member_names(db, user)
        kw = (sales_name or "").strip()
        if kw:
            matched = [n for n in names if kw in n]
            return matched
        return names
    # ASSIGNED 等在客户维度按本人
    return [user.name]


def _order_owned_by(order: dict, allowed: set[str], index, *, include_installer: bool) -> bool:
    customer = index.find(
        order.get("customerId"),
        order.get("orderNo") or "",
        order.get("storeName") or "",
        order.get("customerName") or "",
    )
    if index.visible(customer, order.get("salesName") or "", allowed):
        return True
    return include_installer and (order.get("installer") or "") in allowed


def filter_work_orders(items: list[dict], user: User, perms: dict, db: Session | None = None) -> list[dict]:
    if is_all_data_scope(perms):
        return items
    scope = get_data_scope(perms)
    if scope == "ASSIGNED":
        return [o for o in items if o.get("installer") == user.name]
    if db is None:
        return [o for o in items if o.get("salesName") == user.name]
    from app.services.customer_owner import OwnerIndex

    allowed = set(resolve_sales_names(db, perms, user) or [])
    index = OwnerIndex.load(db)
    include_installer = scope == "DEPT"
    return [
        order for order in items
        if _order_owned_by(order, allowed, index, include_installer=include_installer)
    ]


def assert_work_order_access(order: dict, user: User, perms: dict, db: Session | None = None) -> None:
    if can_access_work_order(order, user, perms, db):
        return
    raise BizError("无权访问该工单", 403)


def can_access_work_order(order: dict, user: User, perms: dict, db: Session | None = None) -> bool:
    if is_all_data_scope(perms):
        return True
    scope = get_data_scope(perms)
    if scope == "ASSIGNED":
        return order.get("installer") == user.name
    if db is None:
        return order.get("salesName") == user.name
    from app.services.customer_owner import OwnerIndex

    allowed = set(resolve_sales_names(db, perms, user) or [])
    index = OwnerIndex.load(db)
    return _order_owned_by(order, allowed, index, include_installer=scope == "DEPT")


def can_access_customer(customer: dict, user: User, perms: dict, db: Session) -> bool:
    if is_all_data_scope(perms):
        return True
    if customer.get("ownerStatus") == "pending":
        return False
    names = resolve_sales_names(db, perms, user)
    if names is None:
        return True
    return customer.get("salesName") in set(names)


def assert_customer_access(customer: dict | None, user: User, perms: dict, db: Session) -> dict:
    if not customer:
        raise BizError("客户不存在", 404)
    if not can_access_customer(customer, user, perms, db):
        raise BizError("无权访问该客户", 403)
    return customer


def can_override_installation_edit(perms: dict) -> bool:
    return is_super_operations(perms)
