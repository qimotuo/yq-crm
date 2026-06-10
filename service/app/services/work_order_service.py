from datetime import datetime

from app.core.exceptions import BizError
from app.data.store import INSTALLERS, store


def list_work_orders(keyword: str = "", status: str = "") -> dict:
    items = store.work_orders
    if status:
        items = [o for o in items if o["status"] == status]
    if keyword:
        kw = keyword.lower()
        items = [
            o for o in items
            if kw in o["orderNo"].lower()
            or keyword in o["customerName"]
            or keyword in o["storeName"]
        ]
    return {"list": items, "total": len(items)}


def create_work_order(body: dict, sales_name: str = "张三") -> dict:
    store.work_order_seq += 1
    oid = store.work_order_seq
    day = datetime.now().strftime("%Y%m%d")
    item = {
        "id": oid,
        "orderNo": f"GD-{day}-{oid:03d}",
        "status": "待派工",
        "installer": "",
        "deviceSupplier": "",
        "deviceModel": "",
        "mac": "",
        "imei": "",
        "simSupplier": "",
        "operator": "",
        "iccid": "",
        "salesName": sales_name,
        **body,
    }
    store.work_orders.insert(0, item)
    return item


def update_work_order(oid: int, body: dict) -> dict:
    for i, o in enumerate(store.work_orders):
        if o["id"] == oid:
            store.work_orders[i] = {**o, **body}
            return store.work_orders[i]
    raise BizError("工单不存在", 404)


def delete_work_order(oid: int) -> bool:
    before = len(store.work_orders)
    store.work_orders = [o for o in store.work_orders if o["id"] != oid]
    if len(store.work_orders) == before:
        raise BizError("工单不存在", 404)
    return True


def dispatch_work_order(oid: int, installer: str) -> dict:
    return update_work_order(oid, {"installer": installer, "status": "已派工"})


def update_status(oid: int, status: str, fail_reason: str = "") -> dict:
    data = {"status": status}
    if fail_reason:
        data["failReason"] = fail_reason
    return update_work_order(oid, data)


def list_installers() -> list[str]:
    return INSTALLERS
