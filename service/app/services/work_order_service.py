from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.data.store import INSTALLERS
from app.db.models import WorkOrder
from app.db.serialize import apply_work_order_patch, work_order_to_dict
from app.services import customer_service as customer_svc


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _append_log(order: WorkOrder, action: str, operator: str, detail: str) -> None:
    logs = list(order.flow_logs or [])
    logs.insert(0, {"time": _now_str(), "action": action, "operator": operator, "detail": detail})
    order.flow_logs = logs


def _get_order(db: Session, oid: int) -> WorkOrder:
    order = db.query(WorkOrder).filter(WorkOrder.id == oid).first()
    if not order:
        raise BizError("工单不存在", 404)
    return order


def _is_dispatch_order(order: WorkOrder) -> bool:
    return order.order_no.startswith("GD-")


def _all_orders(db: Session) -> list[WorkOrder]:
    return db.query(WorkOrder).order_by(WorkOrder.id.desc()).all()


def list_work_orders(
    db: Session,
    keyword: str = "",
    status: str = "",
    mac: str = "",
    iccid: str = "",
    contract_no: str = "",
    device_model: str = "",
) -> dict:
    from app.data.store import store

    items = _all_orders(db)
    result = [work_order_to_dict(o) for o in items]
    if status:
        result = [o for o in result if o["status"] == status]
    if keyword:
        kw = keyword.lower()
        result = [
            o for o in result
            if kw in o["orderNo"].lower()
            or keyword in o["customerName"]
            or keyword in o.get("storeName", "")
            or keyword in o.get("contact", "")
            or keyword in o.get("contactPhone", "")
        ]
    if mac:
        result = [o for o in result if mac in o.get("mac", "")]
    if iccid:
        result = [o for o in result if iccid in o.get("iccid", "")]
    if device_model:
        result = [o for o in result if device_model in o.get("deviceModel", "")]
    if contract_no:
        order_nos = [c["orderNo"] for c in store.contracts if contract_no in c["contractNo"]]
        result = [o for o in result if o["orderNo"] in order_nos]
    return {"list": result, "total": len(result)}


def search_installations(
    db: Session,
    customer_name: str = "",
    store_name: str = "",
    install_date: str = "",
    mac: str = "",
    imei: str = "",
    iccid: str = "",
) -> dict:
    items = [
        work_order_to_dict(o) for o in _all_orders(db)
        if o.status == "已安装" or o.mac or o.iccid
    ]
    if customer_name.strip():
        kw = customer_name.strip()
        items = [o for o in items if kw in o.get("customerName", "") or kw in o.get("storeName", "")]
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


def create_work_order(db: Session, body: dict, sales_name: str = "张三") -> dict:
    day = datetime.now().strftime("%Y%m%d")
    next_id = (db.query(WorkOrder.id).order_by(WorkOrder.id.desc()).limit(1).scalar() or 0) + 1
    order_no = f"GD-{day}-{next_id:03d}"
    customer_id = customer_svc.resolve_customer_id(db, body, sales_name)

    order = WorkOrder(
        order_no=order_no,
        customer_id=customer_id,
        sales_name=sales_name,
        store_name=body.get("storeName", ""),
        customer_name=body.get("customerName") or body.get("storeName", ""),
        address=body.get("address", ""),
        contact=body.get("contact", ""),
        contact_phone=body.get("contactPhone", ""),
        install_date=body.get("installDate") or body.get("installTimeSlot", ""),
        remark=body.get("remark", ""),
        status="待派工",
        install_time_slot=body.get("installTimeSlot", ""),
        price=body.get("price", ""),
        flow_logs=[],
    )
    db.add(order)
    db.flush()
    _append_log(order, "创建工单", sales_name, "销售接单")
    if customer_id:
        customer_svc.link_order_to_customer(db, customer_id, order)
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def update_work_order(db: Session, oid: int, body: dict) -> dict:
    order = _get_order(db, oid)
    apply_work_order_patch(order, body)
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def delete_work_order(db: Session, oid: int) -> bool:
    order = _get_order(db, oid)
    db.delete(order)
    db.commit()
    return True


def dispatch_work_order(db: Session, oid: int, installer: str, operator: str = "管理员") -> dict:
    order = _get_order(db, oid)
    order.installer = installer
    order.status = "已派工"
    order.fail_reason = ""
    _append_log(order, "派工", operator, f"派给 {installer}")
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def update_status(
    db: Session,
    oid: int,
    status: str,
    fail_reason: str = "",
    operator: str = "",
    postpone_date: str = "",
) -> dict:
    order = _get_order(db, oid)
    order.status = status
    if fail_reason:
        order.fail_reason = fail_reason
    if postpone_date:
        order.postpone_date = postpone_date
        order.install_time_slot = postpone_date
    op = operator or order.installer or "系统"
    if fail_reason:
        _append_log(order, "安装失败", op, fail_reason)
    elif status == "推迟安装":
        _append_log(order, "推迟安装", op, f"改期至 {postpone_date or '-'}")
    elif status == "安装成功":
        _append_log(order, "安装成功", op, "现场确认成功，待登记设备")
    elif status == "安装中":
        _append_log(order, "开始安装", op, "状态 → 安装中")
    elif status == "已完成":
        _append_log(order, "确认完成", op, "工单完结")
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def confirm_dispatch(
    db: Session,
    oid: int,
    result: str,
    operator: str = "",
    fail_reason: str = "",
    postpone_date: str = "",
) -> dict:
    _get_order(db, oid)
    if result == "安装成功":
        return update_status(db, oid, "安装成功", operator=operator)
    if result == "安装失败":
        return update_status(db, oid, "失败", fail_reason=fail_reason, operator=operator)
    if result == "推迟安装":
        if not postpone_date.strip():
            raise BizError("请填写推迟日期")
        return update_status(
            db, oid, "推迟安装", operator=operator, postpone_date=postpone_date.strip()
        )
    raise BizError("无效的确认结果")


def install_register(db: Session, oid: int, body: dict, operator: str = "") -> dict:
    """派单流统一安装登记入口"""
    order = _get_order(db, oid)
    if not _is_dispatch_order(order):
        raise BizError("仅支持对派单工单进行安装登记")
    allowed = {
        "installDate", "storeName", "customerName", "address", "contact", "contactPhone",
        "remark", "deviceSupplier", "deviceModel", "mac", "imei",
        "simSupplier", "operator", "iccid", "backupIccid", "installRemark", "failReason",
    }
    patch = {k: v for k, v in body.items() if k in allowed}
    if patch.get("storeName") and not patch.get("customerName"):
        patch["customerName"] = patch["storeName"]
    apply_work_order_patch(order, patch)
    order.status = "已安装"
    op = operator or order.installer or "安装人员"
    detail = f"{order.device_supplier}{order.device_model} / MAC {order.mac or '-'}"
    _append_log(order, "安装登记", op, detail)
    customer_svc.sync_customer_from_order(db, order)
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def list_installers() -> list[str]:
    return INSTALLERS


def get_installation(db: Session, oid: int) -> dict:
    return work_order_to_dict(_get_order(db, oid))


def _can_edit_installation(order: WorkOrder, operator: str, is_admin: bool = False) -> None:
    if is_admin:
        return
    if order.installer and order.installer != operator:
        raise BizError("只能修改自己的登记记录")


def create_installation(db: Session, body: dict, operator: str) -> dict:
    """无派单流程的线下登记：仍生成 GD- 工单并直接标记已安装"""
    install_date = body.get("installDate") or datetime.now().strftime("%Y-%m-%d")
    store_name = body.get("storeName", "")
    payload = {
        **body,
        "storeName": store_name,
        "customerName": body.get("customerName") or store_name,
        "installDate": install_date,
        "status": "已安装",
        "salesName": body.get("salesName", ""),
    }
    day = datetime.now().strftime("%Y%m%d")
    next_id = (db.query(WorkOrder.id).order_by(WorkOrder.id.desc()).limit(1).scalar() or 0) + 1
    order_no = f"GD-{day}-{next_id:03d}"
    customer_id = customer_svc.resolve_customer_id(db, payload, body.get("salesName", ""))

    order = WorkOrder(
        order_no=order_no,
        customer_id=customer_id,
        sales_name=body.get("salesName", ""),
        store_name=store_name,
        customer_name=payload["customerName"],
        address=body.get("address", ""),
        contact=body.get("contact", ""),
        contact_phone=body.get("contactPhone", ""),
        install_date=install_date,
        remark=body.get("remark", ""),
        status="已安装",
        installer=operator,
        device_supplier=body.get("deviceSupplier", ""),
        device_model=body.get("deviceModel", ""),
        mac=body.get("mac", ""),
        imei=body.get("imei", ""),
        sim_supplier=body.get("simSupplier", ""),
        operator=body.get("operator", ""),
        iccid=body.get("iccid", ""),
        backup_iccid=body.get("backupIccid", ""),
        install_remark=body.get("installRemark", ""),
        fail_reason=body.get("failReason", ""),
        flow_logs=[],
    )
    db.add(order)
    db.flush()
    _append_log(order, "新增安装登记", operator, f"门店 {store_name or '-'}")
    customer_svc.sync_customer_from_order(db, order)
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def update_installation(db: Session, oid: int, body: dict, operator: str, is_admin: bool = False) -> dict:
    order = _get_order(db, oid)
    _can_edit_installation(order, operator, is_admin)
    if _is_dispatch_order(order) and order.status == "安装成功":
        return install_register(db, oid, body, operator=operator)

    allowed = {
        "installDate", "storeName", "customerName", "address", "contact", "contactPhone",
        "remark", "status", "deviceSupplier", "deviceModel", "mac", "imei",
        "simSupplier", "operator", "iccid", "backupIccid", "installRemark", "failReason",
        "installTimeSlot", "price", "postponeDate",
    }
    patch = {k: v for k, v in body.items() if k in allowed}
    if patch.get("storeName") and not patch.get("customerName"):
        patch["customerName"] = patch["storeName"]
    apply_work_order_patch(order, patch)
    if order.status == "已安装" or patch.get("status") == "已安装":
        order.status = "已安装"
        customer_svc.sync_customer_from_order(db, order)
    _append_log(order, "修改安装登记", operator, f"状态 → {order.status}")
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def list_my_orders(db: Session, installer_name: str = "") -> dict:
    q = db.query(WorkOrder).filter(
        WorkOrder.order_no.like("GD-%"),
        WorkOrder.status.in_(("已派工", "安装中", "安装成功", "已安装", "失败", "推迟安装")),
    )
    if installer_name:
        q = q.filter(WorkOrder.installer == installer_name)
    rows = q.order_by(WorkOrder.id.desc()).all()
    return {"list": [work_order_to_dict(o) for o in rows], "total": len(rows)}


def list_sales_orders(db: Session, sales_name: str = "") -> dict:
    q = db.query(WorkOrder).filter(WorkOrder.order_no.like("GD-%"))
    if sales_name:
        q = q.filter(WorkOrder.sales_name == sales_name)
    rows = q.order_by(WorkOrder.id.desc()).all()
    return {"list": [work_order_to_dict(o) for o in rows], "total": len(rows)}


def find_work_order_by_order_no(db: Session, order_no: str) -> dict | None:
    if not order_no:
        return None
    order = db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first()
    return work_order_to_dict(order) if order else None
