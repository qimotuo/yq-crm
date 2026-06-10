import re
from datetime import datetime

from app.core.exceptions import BizError
from app.data.store import store

_PHONE_RE = re.compile(r"^1\d{10}$")
_CONTACT_STATUSES = {"正常", "中断合作", "待跟进"}


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _validate_phone(phone: str) -> None:
    if phone and not _PHONE_RE.match(phone):
        raise BizError("手机号格式不正确，需为11位数字")


def list_customers(keyword: str = "", sales_name: str = "") -> dict:
    items = store.customers
    if sales_name:
        items = [c for c in items if c.get("salesName") == sales_name]
    if keyword:
        items = [
            c for c in items
            if keyword in c.get("customerName", "")
            or keyword in c.get("storeName", "")
            or keyword in c.get("phone", "")
        ]
    return {"list": items, "total": len(items)}


def get_customer(customer_id: int) -> dict | None:
    return next((c for c in store.customers if c["id"] == customer_id), None)


def update_customer(body: dict) -> dict:
    cid = body.get("id")
    item = get_customer(cid)
    if not item:
        raise BizError("客户不存在")
    if body.get("phone"):
        _validate_phone(body["phone"])
    if body.get("contactStatus") and body["contactStatus"] not in _CONTACT_STATUSES:
        raise BizError("联系状态无效")
    updated = {**item, **body}
    store.customers = [updated if c["id"] == cid else c for c in store.customers]
    return updated


def list_public_pool(keyword: str = "") -> dict:
    items = [c for c in store.public_pool if c.get("status") == "在公海"]
    if keyword:
        items = [
            c for c in items
            if keyword in c.get("customerName", "") or keyword in c.get("storeName", "")
        ]
    return {"list": items, "total": len(items)}


def create_public_pool_customer(body: dict) -> dict:
    if not body.get("storeName") or not body.get("customerName"):
        raise BizError("店名和客户名称为必填项")
    if body.get("phone"):
        _validate_phone(body["phone"])
    store.public_pool_seq += 1
    item = {
        "id": store.public_pool_seq,
        "storeName": body["storeName"],
        "customerName": body["customerName"],
        "contact": body.get("contact", ""),
        "phone": body.get("phone", ""),
        "address": body.get("address", ""),
        "source": body.get("source", "手动"),
        "status": "在公海",
    }
    store.public_pool.insert(0, item)
    return item


def import_public_pool() -> dict:
    store.public_pool_seq += 1
    new_items = [{
        "id": store.public_pool_seq,
        "storeName": "导入-新茶饮",
        "customerName": "新茶饮连锁",
        "contact": "赵总",
        "phone": "13500135099",
        "address": "导入数据",
        "source": "导入",
        "status": "在公海",
    }]
    store.public_pool = new_items + store.public_pool
    return {"count": len(new_items), "list": new_items}


def claim_public_pool(customer_id: int, sales_name: str) -> dict:
    item = next((c for c in store.public_pool if c["id"] == customer_id), None)
    if not item:
        raise BizError("客户不存在")
    if item.get("status") != "在公海":
        raise BizError("该客户已被领取")
    store.public_pool = [
        {**c, "status": "已领取", "salesName": sales_name} if c["id"] == customer_id else c
        for c in store.public_pool
    ]
    store.customer_seq += 1
    now = _now_str()
    new_customer = {
        **item,
        "id": store.customer_seq,
        "salesName": sales_name,
        "contactStatus": "待跟进",
        "orderNo": "",
        "installDate": "",
        "claimTime": now,
        "lastFollowTime": "",
        "wechatId": "",
    }
    store.customers.insert(0, new_customer)
    return new_customer


def return_to_public_pool(body: dict, sales_name: str = "") -> bool:
    cid = body.get("id")
    item = get_customer(cid)
    if not item:
        raise BizError("客户不存在")
    store.customers = [c for c in store.customers if c["id"] != cid]
    store.public_pool_seq += 1
    pool_item = {
        "id": store.public_pool_seq,
        "storeName": item.get("storeName", ""),
        "customerName": item.get("customerName", ""),
        "contact": item.get("contact", ""),
        "phone": item.get("phone", ""),
        "address": body.get("address", item.get("address", "")),
        "source": "退回",
        "status": "在公海",
    }
    store.public_pool.insert(0, pool_item)
    store.return_log_seq += 1
    store.return_logs.insert(0, {
        "id": store.return_log_seq,
        "customerName": item.get("customerName", ""),
        "storeName": item.get("storeName", ""),
        "salesName": sales_name or item.get("salesName", ""),
        "reason": body.get("reason", "手动退回"),
        "returnTime": _now_str(),
    })
    return True


def list_follow_ups(customer_id: int = 0, sales_name: str = "") -> dict:
    items = store.follow_ups
    if customer_id:
        items = [f for f in items if f.get("customerId") == customer_id]
    if sales_name:
        items = [f for f in items if f.get("salesName") == sales_name]
    items = sorted(items, key=lambda x: x.get("createTime", ""), reverse=True)
    return {"list": items, "total": len(items)}


def create_follow_up(body: dict) -> dict:
    if not body.get("content"):
        raise BizError("跟进内容不能为空")
    store.follow_up_seq += 1
    now = _now_str()
    item = {
        "id": store.follow_up_seq,
        "createTime": now,
        **body,
    }
    store.follow_ups.insert(0, item)
    cid = body.get("customerId")
    if cid:
        store.customers = [
            {**c, "lastFollowTime": now, "contactStatus": "正常" if c.get("contactStatus") == "待跟进" else c.get("contactStatus")}
            if c["id"] == cid else c
            for c in store.customers
        ]
    return item


def list_contacts(keyword: str = "") -> dict:
    items = store.contacts
    if keyword:
        items = [
            c for c in items
            if keyword in c.get("name", "")
            or keyword in c.get("customerName", "")
            or keyword in c.get("phone", "")
        ]
    return {"list": items, "total": len(items)}


def create_contact(body: dict) -> dict:
    if not body.get("name") or not body.get("customerName"):
        raise BizError("客户名称和姓名为必填项")
    if body.get("phone"):
        _validate_phone(body["phone"])
    store.contact_seq += 1
    item = {"id": store.contact_seq, "isPrimary": False, **body}
    if item.get("isPrimary"):
        store.contacts = [
            {**c, "isPrimary": False} if c.get("customerName") == item["customerName"] else c
            for c in store.contacts
        ]
    store.contacts.insert(0, item)
    return item


def update_contact(body: dict) -> dict:
    cid = body.get("id")
    item = next((c for c in store.contacts if c["id"] == cid), None)
    if not item:
        raise BizError("联系人不存在")
    if body.get("phone"):
        _validate_phone(body["phone"])
    updated = {**item, **body}
    if updated.get("isPrimary"):
        store.contacts = [
            {**c, "isPrimary": False} if c.get("customerName") == updated["customerName"] and c["id"] != cid else c
            for c in store.contacts
        ]
    store.contacts = [updated if c["id"] == cid else c for c in store.contacts]
    return updated


def import_contacts() -> dict:
    store.contact_seq += 1
    new_items = [{
        "id": store.contact_seq,
        "customerName": "导入客户示例",
        "storeName": "示例门店",
        "name": "导入联系人",
        "phone": "13800138888",
        "title": "经理",
        "isPrimary": True,
    }]
    store.contacts = new_items + store.contacts
    return {"count": len(new_items)}


def get_pool_config() -> dict:
    return store.pool_config


def update_pool_config(body: dict) -> dict:
    store.pool_config = {**store.pool_config, **body}
    return store.pool_config


def list_return_logs() -> dict:
    return {"list": store.return_logs, "total": len(store.return_logs)}
