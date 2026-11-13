import re
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import Customer, StockOut, User, WorkOrder
from app.db.serialize import apply_work_order_patch, work_order_to_dict
from app.services import customer_service as customer_svc
from app.services.install_followup import open_bill_and_contract


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


def _attach_card_nos(db: Session, items: list[dict]) -> None:
    """电信/移动/旧卡号记在出库单上，没有出库单时按运营商从工单卡号拆。"""
    outs: dict[str, StockOut] = {}
    for row in db.query(StockOut).order_by(StockOut.id).all():
        if row.order_no:
            outs[row.order_no] = row
    for item in items:
        out = outs.get(item.get("orderNo") or "")
        telecom = (out.telecom_no if out else "") or ""
        mobile = (out.mobile_no if out else "") or ""
        iccid, backup = item.get("iccid") or "", item.get("backupIccid") or ""
        if not telecom and not mobile:
            operator = item.get("operator") or ""
            if "移动" in operator and "电信" not in operator:
                mobile, telecom = iccid, backup
            else:
                telecom, mobile = iccid, backup
        elif not mobile:
            mobile = backup
        elif not telecom:
            telecom = backup
        item["telecomNo"] = telecom
        item["mobileNo"] = mobile
        item["oldCardNo"] = (out.replaced_card_no if out else "") or ""


def _q(filters: dict, key: str) -> str:
    return str(filters.get(key) or "").strip()


def _contains(value, keyword: str) -> bool:
    if not keyword:
        return True
    return keyword.lower() in str(value or "").lower()


def _norm_code(value) -> str:
    return str(value or "").replace(":", "").replace("-", "").replace(" ", "").upper()


def _mac_contains(value, keyword: str) -> bool:
    if not keyword:
        return True
    return _norm_code(keyword) in _norm_code(value)


def _norm_date(value) -> str:
    match = re.search(r"(\d{4})\D(\d{1,2})\D(\d{1,2})", str(value or ""))
    if not match:
        return ""
    year, month, day = match.groups()
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def _in_date_range(value, start: str, end: str) -> bool:
    if not start and not end:
        return True
    current = _norm_date(value)
    if not current:
        return False
    if start and current < _norm_date(start):
        return False
    if end and current > _norm_date(end):
        return False
    return True


_KEYWORD_FIELDS = (
    "orderNo", "customerName", "storeName", "contact", "contactPhone", "address",
    "salesName", "installer", "deviceSupplier", "deviceModel", "mac", "imei",
    "simSupplier", "operator", "iccid", "backupIccid", "telecomNo", "mobileNo",
    "oldCardNo", "cardPackage", "remark", "installRemark",
)


def _match_work_order(order: dict, filters: dict) -> bool:
    status = _q(filters, "status")
    if status and order.get("status") != status:
        return False

    keyword = _q(filters, "keyword")
    if keyword:
        blob = " ".join(str(order.get(key) or "") for key in _KEYWORD_FIELDS)
        norm_kw = _norm_code(keyword)
        mac_hit = bool(norm_kw) and norm_kw in _norm_code(order.get("mac"))
        if keyword.lower() not in blob.lower() and not mac_hit:
            return False

    if not _contains(order.get("installer"), _q(filters, "installer")):
        return False
    if not _contains(order.get("deviceModel"), _q(filters, "deviceModel")):
        return False
    if not _mac_contains(order.get("mac"), _q(filters, "mac")):
        return False

    iccid = _q(filters, "iccid")
    if iccid and not any(
        iccid in str(order.get(key) or "")
        for key in ("iccid", "backupIccid", "telecomNo", "mobileNo", "oldCardNo")
    ):
        return False

    if not _in_date_range(order.get("installDate"), _q(filters, "installDateFrom"), _q(filters, "installDateTo")):
        return False
    return True


def list_work_orders(
    db: Session,
    keyword: str = "",
    status: str = "",
    mac: str = "",
    iccid: str = "",
    contract_no: str = "",
    device_model: str = "",
    filters: dict | None = None,
) -> dict:
    merged = {
        "keyword": keyword,
        "status": status,
        "mac": mac,
        "iccid": iccid,
        "contractNo": contract_no,
        "deviceModel": device_model,
    }
    for key, value in (filters or {}).items():
        if value not in (None, ""):
            merged[key] = value

    items = _all_orders(db)
    result = [work_order_to_dict(o) for o in items]
    _attach_card_nos(db, result)
    result = [o for o in result if _match_work_order(o, merged)]

    contract = _q(merged, "contractNo")
    if contract:
        from app.db.models import Contract

        order_nos = {
            c.order_no
            for c in db.query(Contract).filter(Contract.contract_no.contains(contract)).all()
        }
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
    if customer_id:
        owner = db.query(Customer).filter(Customer.id == customer_id).first()
        if owner and (owner.owner_status or "confirmed") == "confirmed" and owner.sales_name:
            sales_name = owner.sales_name

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
        "installPhotos",
    }
    patch = {k: v for k, v in body.items() if k in allowed}
    if patch.get("storeName") and not patch.get("customerName"):
        patch["customerName"] = patch["storeName"]
    if "installPhotos" in patch:
        photos = patch["installPhotos"] or []
        if not isinstance(photos, list):
            raise BizError("现场照片格式不正确")
        if len(photos) > 3:
            raise BizError("现场照片最多 3 张")
        patch["installPhotos"] = [str(p).strip() for p in photos if str(p).strip()]
    apply_work_order_patch(order, patch)
    order.status = "已安装"
    op = operator or order.installer or "安装人员"
    detail = f"{order.device_supplier}{order.device_model} / MAC {order.mac or '-'}"
    _append_log(order, "安装登记", op, detail)
    customer_svc.sync_customer_from_order(db, order)
    open_bill_and_contract(db, order)
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def list_installers(db: Session) -> list[str]:
    rows = (
        db.query(User.name)
        .filter(User.role_code == "installer", User.enabled.is_(True))
        .order_by(User.id)
        .all()
    )
    return [r[0] for r in rows if r[0]]


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
        install_photos=list(body.get("installPhotos") or []),
        flow_logs=[],
    )
    db.add(order)
    db.flush()
    _append_log(order, "新增安装登记", operator, f"门店 {store_name or '-'}")
    customer_svc.sync_customer_from_order(db, order)
    open_bill_and_contract(db, order)
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
        open_bill_and_contract(db, order)
    _append_log(order, "修改安装登记", operator, f"状态 → {order.status}")
    db.commit()
    db.refresh(order)
    return work_order_to_dict(order)


def _my_order_base_query(db: Session, installer_name: str = ""):
    """派工流程仍限 GD- 工单；已安装的历史工单（含关联导入）也算已完成安装。"""
    q = db.query(WorkOrder).filter(or_(
        WorkOrder.status == "已安装",
        (WorkOrder.order_no.like("GD-%")) & WorkOrder.status.in_(
            ("已派工", "安装中", "安装成功", "失败", "推迟安装")
        ),
    ))
    if installer_name:
        q = q.filter(WorkOrder.installer == installer_name)
    return q


def _filter_my_orders(rows: list[WorkOrder], keyword: str = "", status: str = "", install_date: str = "") -> list[WorkOrder]:
    result = rows
    if status:
        result = [o for o in result if o.status == status]
    if keyword:
        kw = keyword.lower().replace(":", "")
        result = [
            o for o in result
            if kw in o.order_no.lower()
            or keyword in (o.customer_name or "")
            or keyword in (o.store_name or "")
            or keyword in (o.address or "")
            or keyword in (o.contact or "")
            or keyword in (o.contact_phone or "")
            or kw in (o.mac or "").lower().replace(":", "")
            or keyword in (o.imei or "")
            or keyword in (o.iccid or "")
            or keyword in (o.backup_iccid or "")
            or keyword in (o.installer or "")
            or keyword in (o.device_model or "")
            or keyword in (o.device_supplier or "")
            or keyword in (o.sim_supplier or "")
        ]
    if install_date:
        result = [o for o in result if install_date in (o.install_date or "")]
    return sorted(result, key=lambda o: o.id, reverse=True)


def list_my_orders(
    db: Session,
    installer_name: str = "",
    keyword: str = "",
    status: str = "",
    install_date: str = "",
) -> dict:
    base_rows = _my_order_base_query(db, installer_name).all()
    status_counts = {
        "all": len(base_rows),
        "assigned": sum(1 for o in base_rows if o.status == "已派工"),
        "installing": sum(1 for o in base_rows if o.status == "安装中"),
        "done": sum(1 for o in base_rows if o.status == "已安装"),
    }
    rows = _filter_my_orders(base_rows, keyword, status, install_date)
    items = [work_order_to_dict(o) for o in rows]
    _attach_card_nos(db, items)
    return {
        "list": items,
        "total": len(items),
        "statusCounts": status_counts,
    }


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
