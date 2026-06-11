from datetime import datetime

from app.core.exceptions import BizError
from app.data.store import INSTALLERS, store


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _append_log(order: dict, action: str, operator: str, detail: str) -> None:
    logs = order.setdefault("flowLogs", [])
    logs.insert(0, {"time": _now_str(), "action": action, "operator": operator, "detail": detail})


def list_work_orders(
    keyword: str = "",
    status: str = "",
    mac: str = "",
    iccid: str = "",
    contract_no: str = "",
    device_model: str = "",
) -> dict:
    items = store.work_orders
    if status:
        items = [o for o in items if o["status"] == status]
    if keyword:
        kw = keyword.lower()
        items = [
            o for o in items
            if kw in o["orderNo"].lower()
            or keyword in o["customerName"]
            or keyword in o.get("storeName", "")
            or keyword in o.get("contact", "")
            or keyword in o.get("contactPhone", "")
        ]
    if mac:
        items = [o for o in items if mac in o.get("mac", "")]
    if iccid:
        items = [o for o in items if iccid in o.get("iccid", "")]
    if device_model:
        items = [o for o in items if device_model in o.get("deviceModel", "")]
    if contract_no:
        order_nos = [c["orderNo"] for c in store.contracts if contract_no in c["contractNo"]]
        items = [o for o in items if o["orderNo"] in order_nos]
    return {"list": items, "total": len(items)}


def search_installations(
    customer_name: str = "",
    store_name: str = "",
    install_date: str = "",
    mac: str = "",
    imei: str = "",
    iccid: str = "",
) -> dict:
    """安装登记查询：按时间、客户/门店、MAC、IMEI、主卡/备用卡检索"""
    items = [
        o for o in store.work_orders
        if o.get("status") == "已安装" or o.get("mac") or o.get("iccid")
    ]
    if customer_name.strip():
        kw = customer_name.strip()
        items = [
            o for o in items
            if kw in o.get("customerName", "") or kw in o.get("storeName", "")
        ]
    if store_name.strip():
        kw = store_name.strip()
        items = [o for o in items if kw in o.get("storeName", "")]
    if install_date:
        items = [o for o in items if install_date in (o.get("installDate") or "")]
    if mac:
        mac_kw = mac.strip().replace(":", "").upper()
        items = [
            o for o in items
            if mac_kw in (o.get("mac") or "").replace(":", "").upper()
        ]
    if imei:
        items = [o for o in items if imei in (o.get("imei") or "")]
    if iccid:
        items = [
            o for o in items
            if iccid in (o.get("iccid") or "") or iccid in (o.get("backupIccid") or "")
        ]
    items = sorted(items, key=lambda x: x.get("installDate") or "", reverse=True)
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
        "installRemark": "",
        "flowLogs": [],
        "salesName": sales_name,
        **body,
    }
    _append_log(item, "创建工单", sales_name, "销售接单")
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


def dispatch_work_order(oid: int, installer: str, operator: str = "管理员") -> dict:
    order = update_work_order(oid, {"installer": installer, "status": "已派工", "failReason": ""})
    _append_log(order, "派工", operator, f"派给 {installer}")
    return order


def update_status(oid: int, status: str, fail_reason: str = "", operator: str = "") -> dict:
    data: dict = {"status": status}
    if fail_reason:
        data["failReason"] = fail_reason
    order = update_work_order(oid, data)
    op = operator or order.get("installer") or "系统"
    if fail_reason:
        _append_log(order, "安装失败", op, fail_reason)
    elif status == "安装中":
        _append_log(order, "开始安装", op, "状态 → 安装中")
    elif status == "已完成":
        _append_log(order, "确认完成", op, "工单完结")
    return order


def install_register(oid: int, body: dict, operator: str = "") -> dict:
    body["status"] = "已安装"
    order = update_work_order(oid, body)
    op = operator or order.get("installer") or "安装人员"
    detail = f"{order.get('deviceSupplier', '')}{order.get('deviceModel', '')} / MAC {order.get('mac', '-')}"
    _append_log(order, "安装登记", op, detail)
    return order


def list_installers() -> list[str]:
    return INSTALLERS


def get_installation(oid: int) -> dict:
    for o in store.work_orders:
        if o["id"] == oid:
            return o
    raise BizError("登记记录不存在", 404)


def _can_edit_installation(order: dict, operator: str, is_admin: bool = False) -> None:
    if is_admin:
        return
    if order.get("installer") and order.get("installer") != operator:
        raise BizError("只能修改自己的登记记录")


def create_installation(body: dict, operator: str) -> dict:
    store.work_order_seq += 1
    oid = store.work_order_seq
    day = datetime.now().strftime("%Y%m%d")
    install_date = body.get("installDate") or datetime.now().strftime("%Y-%m-%d")
    store_name = body.get("storeName", "")
    item = {
        "id": oid,
        "orderNo": f"AZ-{day}-{oid:03d}",
        "salesName": body.get("salesName", ""),
        "storeName": store_name,
        "customerName": body.get("customerName") or store_name,
        "address": body.get("address", ""),
        "contact": body.get("contact", ""),
        "contactPhone": body.get("contactPhone", ""),
        "installDate": install_date,
        "remark": body.get("remark", ""),
        "status": body.get("status", "已安装"),
        "installer": operator,
        "deviceSupplier": body.get("deviceSupplier", ""),
        "deviceModel": body.get("deviceModel", ""),
        "mac": body.get("mac", ""),
        "imei": body.get("imei", ""),
        "simSupplier": body.get("simSupplier", ""),
        "operator": body.get("operator", ""),
        "iccid": body.get("iccid", ""),
        "backupIccid": body.get("backupIccid", ""),
        "installRemark": body.get("installRemark", ""),
        "failReason": body.get("failReason", ""),
        "flowLogs": [],
    }
    _append_log(item, "新增安装登记", operator, f"门店 {store_name or '-'}")
    store.work_orders.insert(0, item)
    return item


def update_installation(oid: int, body: dict, operator: str, is_admin: bool = False) -> dict:
    order = get_installation(oid)
    _can_edit_installation(order, operator, is_admin)
    allowed = {
        "installDate", "storeName", "customerName", "address", "contact", "contactPhone",
        "remark", "status", "deviceSupplier", "deviceModel", "mac", "imei",
        "simSupplier", "operator", "iccid", "backupIccid", "installRemark", "failReason",
    }
    patch = {k: v for k, v in body.items() if k in allowed}
    if patch.get("storeName") and not patch.get("customerName"):
        patch.setdefault("customerName", patch["storeName"])
    updated = update_work_order(oid, patch)
    _append_log(updated, "修改安装登记", operator, f"状态 → {updated.get('status', '-')}")
    return updated


def list_my_orders(installer_name: str = "") -> dict:
    items = [
        o for o in store.work_orders
        if o["status"] in ("已派工", "安装中", "已安装", "失败")
    ]
    if installer_name:
        items = [o for o in items if o.get("installer") == installer_name]
    return {"list": items, "total": len(items)}
