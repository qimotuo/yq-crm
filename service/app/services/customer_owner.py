"""客户负责销售：唯一归属、历史初始化、转交及关联数据可见性。"""

from __future__ import annotations

import logging
from collections import defaultdict

from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.core.data_scope import (
    get_data_scope,
    is_all_data_scope,
    list_dept_member_names,
    resolve_sales_names,
)
from app.core.exceptions import BizError
from app.db.models import Contract, Customer, Finance, FollowUp, Schedule, User, WorkOrder

logger = logging.getLogger(__name__)

_INIT_ID = "customer_owner_init_v1"
_NOTE_LIMIT = 500


def _clip(text_value: str) -> str:
    text_value = (text_value or "").strip()
    if len(text_value) <= _NOTE_LIMIT:
        return text_value
    return text_value[: _NOTE_LIMIT - 1] + "…"


def sales_user_rows(db: Session) -> list[User]:
    return (
        db.query(User)
        .filter(User.enabled.is_(True), User.role_code == "sales")
        .order_by(User.id)
        .all()
    )


def sales_name_counts(db: Session) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for user in sales_user_rows(db):
        name = (user.name or "").strip()
        if name:
            counts[name] += 1
    return dict(counts)


def classify_signals(raw_names: list[str], users_by_name: dict[str, int]) -> tuple[str, str, str]:
    """根据销售姓名和开发记录判断归属。

    返回 (confirmed|pending, 负责销售, 说明)。
    对不上、为空、或对应多名销售时不指定负责人。
    """
    names: list[str] = []
    seen: set[str] = set()
    for raw in raw_names:
        name = (raw or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        names.append(name)
    if not names:
        return "pending", "", "销售姓名为空，且没有可对应的开发记录"

    resolved: list[str] = []
    unknown: list[str] = []
    ambiguous: list[str] = []
    for name in names:
        count = users_by_name.get(name, 0)
        if count == 1:
            resolved.append(name)
        elif count > 1:
            ambiguous.append(name)
        else:
            unknown.append(name)

    if len(resolved) == 1 and not unknown and not ambiguous:
        return "confirmed", resolved[0], ""

    parts: list[str] = []
    if len(resolved) > 1:
        parts.append("对应多个销售：" + "、".join(resolved))
    if unknown and resolved:
        parts.append("销售姓名与开发记录不一致：" + "、".join(unknown))
    elif unknown and not resolved:
        parts.append("对不上现有销售：" + "、".join(unknown))
    if ambiguous:
        parts.append("姓名对应多名销售账号：" + "、".join(ambiguous))
    if not parts:
        parts.append("无法唯一确定负责销售")
    return "pending", "", "；".join(parts)


def require_unique_sales(db: Session, sales_name: str) -> User:
    name = (sales_name or "").strip()
    if not name:
        raise BizError("负责销售为必填项")
    matched = [user for user in sales_user_rows(db) if (user.name or "").strip() == name]
    if len(matched) != 1:
        raise BizError("负责销售须是系统中唯一的销售人员")
    return matched[0]


def resolve_owner_name(db: Session, sales_name: str, *, user: User, perms: dict) -> str:
    """新建时确定负责销售。销售本人固定为自己，主管/管理员必须指定唯一销售。"""
    if is_all_data_scope(perms):
        return require_unique_sales(db, sales_name).name
    scope = get_data_scope(perms)
    if scope in ("SELF", "ASSIGNED"):
        return require_unique_sales(db, user.name).name
    if scope == "DEPT":
        picked = (sales_name or user.name or "").strip()
        allowed = set(list_dept_member_names(db, user))
        if picked not in allowed:
            raise BizError("只能指定本部门销售")
        return require_unique_sales(db, picked).name
    return require_unique_sales(db, sales_name or user.name).name


def list_sales_options(db: Session, user: User, perms: dict) -> list[dict]:
    rows = sales_user_rows(db)
    if not is_all_data_scope(perms):
        scope = get_data_scope(perms)
        if scope == "DEPT":
            allowed = set(list_dept_member_names(db, user))
            rows = [row for row in rows if (row.name or "").strip() in allowed]
        else:
            rows = [row for row in rows if row.id == user.id]
    return [{"id": row.id, "name": row.name} for row in rows if (row.name or "").strip()]


class OwnerIndex:
    def __init__(self, customers: list[Customer]):
        self.by_id = {row.id: row for row in customers}
        self.by_order: dict[str, Customer] = {}
        for row in customers:
            order_no = (row.order_no or "").strip()
            if order_no and order_no not in self.by_order:
                self.by_order[order_no] = row
        buckets: dict[tuple[str, str], list[Customer]] = defaultdict(list)
        for row in customers:
            store = (row.store_name or "").strip()
            name = (row.customer_name or "").strip()
            if store and name:
                buckets[(store, name)].append(row)
        self.by_name = {key: rows[0] for key, rows in buckets.items() if len(rows) == 1}

    @classmethod
    def load(cls, db: Session) -> "OwnerIndex":
        return cls(db.query(Customer).all())

    def find(
        self,
        customer_id: int | None = None,
        order_no: str = "",
        store: str = "",
        customer_name: str = "",
    ) -> Customer | None:
        if customer_id and int(customer_id) in self.by_id:
            return self.by_id[int(customer_id)]
        order_no = (order_no or "").strip()
        if order_no and order_no in self.by_order:
            return self.by_order[order_no]
        store = (store or "").strip()
        customer_name = (customer_name or "").strip()
        if store and customer_name:
            return self.by_name.get((store, customer_name))
        return None

    @staticmethod
    def visible(customer: Customer | None, record_sales: str, allowed: set[str] | None) -> bool:
        if allowed is None:
            return True
        if customer is not None:
            if (customer.owner_status or "confirmed") != "confirmed":
                return False
            return (customer.sales_name or "") in allowed
        return (record_sales or "") in allowed


def assert_owned_record(
    db: Session,
    perms: dict,
    user: User,
    *,
    customer_id: int | None = None,
    order_no: str = "",
    store: str = "",
    customer_name: str = "",
    sales_name: str = "",
) -> None:
    allowed_list = resolve_sales_names(db, perms, user)
    if allowed_list is None:
        return
    if get_data_scope(perms) == "ASSIGNED":
        return
    index = OwnerIndex.load(db)
    customer = index.find(customer_id, order_no, store, customer_name)
    if not index.visible(customer, sales_name, set(allowed_list)):
        raise BizError("无权访问该数据", 403)


def _identity_keys(row: Customer) -> list[tuple[str, str]]:
    """同一店名 + 客户名才视为同一客户。不按手机号合并，避免连锁店共用号码被当成重复。"""
    store = (row.store_name or "").strip()
    name = (row.customer_name or "").strip()
    if store and name:
        return [("name", f"{store}\0{name}")]
    return []


def _signal_names(
    row: Customer,
    follows: list[FollowUp],
    orders: list[WorkOrder],
) -> list[str]:
    names = [row.sales_name or ""]
    names.extend(item.sales_name or "" for item in follows)
    names.extend(item.sales_name or "" for item in orders)
    return names


def _collect_orders(row: Customer, by_customer: dict[int, list[WorkOrder]], by_order: dict[str, list[WorkOrder]]) -> list[WorkOrder]:
    found: dict[int, WorkOrder] = {item.id: item for item in by_customer.get(row.id, [])}
    order_no = (row.order_no or "").strip()
    if order_no:
        for item in by_order.get(order_no, []):
            found[item.id] = item
    return list(found.values())


def _apply_duplicate_rules(customers: list[Customer], plans: dict[int, dict]) -> None:
    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for row in customers:
        for key in _identity_keys(row):
            groups[key].append(row.id)
    seen: set[tuple[int, ...]] = set()
    for ids in groups.values():
        uniq = list(dict.fromkeys(ids))
        if len(uniq) < 2:
            continue
        signature = tuple(sorted(uniq))
        if signature in seen:
            continue
        seen.add(signature)
        owners = {plans[item_id]["sales_name"] for item_id in uniq if plans[item_id]["status"] == "confirmed"}
        pending = any(plans[item_id]["status"] == "pending" for item_id in uniq)
        id_text = "、".join(str(item_id) for item_id in uniq)
        if not owners:
            extra = f"同店名同客户有多条记录（id {id_text}）。"
            for item_id in uniq:
                if extra not in plans[item_id]["note"]:
                    plans[item_id]["note"] = _clip((plans[item_id]["note"] + extra).strip())
            continue
        if pending or len(owners) != 1:
            clues = []
            for item_id in uniq:
                plan = plans[item_id]
                if plan["status"] == "confirmed" and plan["sales_name"]:
                    clues.append(f"#{item_id}原可归{plan['sales_name']}")
                elif plan["note"]:
                    clues.append(f"#{item_id}{plan['note']}")
            note = f"同一客户存在多条记录（id {id_text}），无法唯一归属。" + "；".join(clues)
            for item_id in uniq:
                plans[item_id] = {"status": "pending", "sales_name": "", "note": _clip(note), "signals": plans[item_id]["signals"]}
        else:
            owner = next(iter(owners))
            note = _clip(f"与客户 {id_text} 重复，目前都归 {owner}，请人工合并，避免重复统计。")
            for item_id in uniq:
                if not plans[item_id]["note"]:
                    plans[item_id]["note"] = note


def apply_owner_to_related(
    db: Session,
    customer: Customer,
    sales_name: str,
    user_id: int | None,
    from_names: set[str],
) -> dict:
    """把该客户在销售侧的工单、合同、财务、跟进、日程改记到新负责销售。"""
    from_names = {name.strip() for name in from_names if name and name.strip()}
    counts = {"workOrders": 0, "finance": 0, "contracts": 0, "followUps": 0, "schedules": 0}

    orders: dict[int, WorkOrder] = {
        row.id: row
        for row in db.query(WorkOrder).filter(WorkOrder.customer_id == customer.id).all()
    }
    order_no = (customer.order_no or "").strip()
    if order_no:
        for row in db.query(WorkOrder).filter(WorkOrder.order_no == order_no).all():
            orders[row.id] = row
    order_nos = {row.order_no for row in orders.values() if row.order_no}
    if order_no:
        order_nos.add(order_no)
    for row in orders.values():
        if row.sales_name != sales_name:
            row.sales_name = sales_name
            counts["workOrders"] += 1

    def _touch_named(model, counter: str):
        rows: dict[int, object] = {}
        if order_nos:
            for row in db.query(model).filter(model.order_no.in_(order_nos)).all():
                rows[row.id] = row
        store = (customer.store_name or "").strip()
        name = (customer.customer_name or "").strip()
        if store and name:
            for row in (
                db.query(model)
                .filter(model.store_name == store, model.customer_name == name)
                .all()
            ):
                sales = (row.sales_name or "").strip()
                if row.id in rows or not sales or sales in from_names or sales == sales_name:
                    rows[row.id] = row
        for row in rows.values():
            if row.sales_name != sales_name:
                row.sales_name = sales_name
                counts[counter] += 1

    _touch_named(Finance, "finance")
    _touch_named(Contract, "contracts")

    follows = db.query(FollowUp).filter(FollowUp.customer_id == customer.id).all()
    for row in follows:
        changed = False
        if row.sales_name != sales_name:
            row.sales_name = sales_name
            changed = True
        if user_id and row.user_id != user_id:
            row.user_id = user_id
            changed = True
        if changed:
            counts["followUps"] += 1

    same_name = (
        db.query(Customer.id)
        .filter(Customer.customer_name == customer.customer_name)
        .count()
        if (customer.customer_name or "").strip()
        else 0
    )
    schedules = db.query(Schedule).filter(Schedule.customer_name == customer.customer_name).all() if customer.customer_name else []
    for row in schedules:
        sales = (row.sales_name or "").strip()
        if same_name != 1 and sales and sales not in from_names and sales != sales_name:
            continue
        changed = False
        if row.sales_name != sales_name:
            row.sales_name = sales_name
            changed = True
        if user_id and row.user_id != user_id:
            row.user_id = user_id
            changed = True
        if changed:
            counts["schedules"] += 1
    return counts


def init_customer_ownership(db: Session) -> dict:
    """按现有销售姓名和开发记录做一次归属。只执行一次。"""
    done = db.execute(text(
        "SELECT 1 FROM schema_migrations WHERE id = :id"
    ), {"id": _INIT_ID}).first()
    if done:
        return {"initialized": False, "pending": []}

    customers = db.query(Customer).order_by(Customer.id).all()
    counts = sales_name_counts(db)
    follows_by_customer: dict[int, list[FollowUp]] = defaultdict(list)
    for row in db.query(FollowUp).all():
        if row.customer_id:
            follows_by_customer[row.customer_id].append(row)
    orders = db.query(WorkOrder).all()
    orders_by_customer: dict[int, list[WorkOrder]] = defaultdict(list)
    orders_by_no: dict[str, list[WorkOrder]] = defaultdict(list)
    for row in orders:
        if row.customer_id:
            orders_by_customer[row.customer_id].append(row)
        if (row.order_no or "").strip():
            orders_by_no[row.order_no].append(row)

    users = {user.name: user for user in sales_user_rows(db) if counts.get(user.name) == 1}
    plans: dict[int, dict] = {}
    for row in customers:
        linked_orders = _collect_orders(row, orders_by_customer, orders_by_no)
        signals = _signal_names(row, follows_by_customer.get(row.id, []), linked_orders)
        status, sales_name, note = classify_signals(signals, counts)
        plans[row.id] = {
            "status": status,
            "sales_name": sales_name,
            "note": _clip(note),
            "signals": {(name or "").strip() for name in signals if (name or "").strip()},
        }
    _apply_duplicate_rules(customers, plans)

    pending = []
    for row in customers:
        plan = plans[row.id]
        old_name = (row.sales_name or "").strip()
        row.owner_status = plan["status"]
        row.owner_note = plan["note"]
        if plan["status"] == "confirmed":
            target = users.get(plan["sales_name"])
            from_names = set(plan["signals"])
            from_names.add(old_name)
            apply_owner_to_related(
                db,
                row,
                plan["sales_name"],
                target.id if target else None,
                from_names,
            )
            row.sales_name = plan["sales_name"]
        else:
            row.sales_name = ""
            pending.append({
                "id": row.id,
                "storeName": row.store_name,
                "customerName": row.customer_name,
                "phone": row.phone,
                "ownerNote": row.owner_note,
            })

    db.execute(text("INSERT INTO schema_migrations (id) VALUES (:id)"), {"id": _INIT_ID})
    db.commit()
    logger.info("客户归属初始化完成，待确认 %s 条", len(pending))
    return {"initialized": True, "pending": pending}


def transfer_customer(db: Session, customer_id: int, sales_name: str, reason: str = "") -> dict:
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        raise BizError("客户不存在", 404)
    target = require_unique_sales(db, sales_name)
    old = (row.sales_name or "").strip()
    if row.owner_status == "confirmed" and old == target.name:
        raise BizError("负责销售未变化")
    from_names = {old} if old else set()
    counts = apply_owner_to_related(db, row, target.name, target.id, from_names)
    row.sales_name = target.name
    row.owner_status = "confirmed"
    row.owner_note = ""
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "customerName": row.customer_name,
        "storeName": row.store_name,
        "fromSalesName": old,
        "salesName": target.name,
        "reason": (reason or "").strip(),
        "related": counts,
    }


def list_owner_review(db: Session) -> dict:
    rows = (
        db.query(Customer)
        .filter(or_(Customer.owner_status == "pending", Customer.owner_note != ""))
        .order_by(Customer.owner_status.desc(), Customer.id)
        .all()
    )
    items = [
        {
            "id": row.id,
            "storeName": row.store_name,
            "customerName": row.customer_name,
            "contact": row.contact,
            "phone": row.phone,
            "salesName": row.sales_name,
            "ownerStatus": row.owner_status or "confirmed",
            "ownerNote": row.owner_note or "",
        }
        for row in rows
    ]
    return {"list": items, "total": len(items)}
