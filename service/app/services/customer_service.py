import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import Contact, Customer, FollowUp, PublicPoolCustomer, ReturnLog, User, WorkOrder
from app.db.serialize import customer_to_dict, device_patch_from_order
from app.services import notify_service

_PHONE_RE = re.compile(r"^1\d{10}$")
_CONTACT_STATUSES = {"正常", "中断合作", "待跟进"}
_FOLLOW_TYPES = {"电话", "微信", "上门"}
_DEVICE_FIELDS = (
    "installDate", "deviceSupplier", "deviceModel", "mac", "imei",
    "simSupplier", "operator", "iccid", "backupIccid",
)
_UPDATABLE_FIELDS = {
    "storeName", "customerName", "contact", "phone", "address",
    "contactStatus", "orderNo", "installDate", "deviceSupplier", "deviceModel",
    "mac", "imei", "iccid", "iccid2", "backupIccid", "operator", "simSupplier",
    "contractPeriod", "price", "invoiceType", "wechatId", "idCardFront", "idCardBack",
}


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _validate_phone(phone: str) -> None:
    if phone and not _PHONE_RE.match(phone):
        raise BizError("手机号格式不正确，需为11位数字")


def _get_customer_row(db: Session, customer_id: int) -> Customer:
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    if not row:
        raise BizError("客户不存在")
    return row


def _find_finance(db: Session, order_no: str) -> dict | None:
    if not order_no:
        return None
    from app.db.models import Finance

    row = db.query(Finance).filter(Finance.order_no == order_no).first()
    if not row:
        return None
    return {
        "id": row.id,
        "totalAmount": row.total_amount,
        "paidAmount": row.paid_amount,
        "unpaidAmount": row.unpaid_amount,
        "paymentStatus": row.payment_status,
    }


def _normalize_customer_body(body: dict) -> dict:
    data = dict(body)
    if "iccid2" in data:
        data["backupIccid"] = data.get("iccid2") or ""
    elif data.get("backupIccid") and not data.get("iccid2"):
        data["iccid2"] = data["backupIccid"]
    return data


def _serialize_customer(item: dict) -> dict:
    data = {**item}
    iccid2 = data.get("iccid2") or data.get("backupIccid") or ""
    data["iccid2"] = iccid2
    data["backupIccid"] = iccid2
    return data


def _enrich_customer_dict(db: Session, data: dict) -> dict:
    order_no = data.get("orderNo", "")
    if order_no:
        order = db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first()
        if order:
            for field_camel, field_snake in [
                ("installDate", "install_date"), ("deviceSupplier", "device_supplier"),
                ("deviceModel", "device_model"), ("mac", "mac"), ("imei", "imei"),
                ("simSupplier", "sim_supplier"), ("operator", "operator"),
                ("iccid", "iccid"), ("backupIccid", "backup_iccid"), ("price", "price"),
            ]:
                if not data.get(field_camel) and getattr(order, field_snake, ""):
                    data[field_camel] = getattr(order, field_snake)
    finance = _find_finance(db, order_no)
    if finance:
        data.setdefault("financeId", finance.get("id"))
        data.setdefault("totalAmount", finance.get("totalAmount", 0))
        data.setdefault("paidAmount", finance.get("paidAmount", 0))
        data.setdefault("unpaidAmount", finance.get("unpaidAmount", 0))
        data.setdefault("paymentStatus", finance.get("paymentStatus", ""))
        if finance.get("paidAmount") is not None:
            data.setdefault("lastPaymentAmount", finance.get("paidAmount"))
        data.setdefault("lastPaymentTime", finance.get("lastPaymentTime", ""))
    return _serialize_customer(data)


def _enrich_customer(db: Session, customer: Customer) -> dict:
    return _enrich_customer_dict(db, customer_to_dict(customer))


def _norm_mac(value: str) -> str:
    return (value or "").replace(":", "").replace("-", "").upper()


def _match_mac(value: str, keyword: str) -> bool:
    kw = keyword.strip()
    if not kw:
        return True
    return _norm_mac(kw) in _norm_mac(value)


def _match_iccid(data: dict, keyword: str) -> bool:
    kw = keyword.strip()
    if not kw:
        return True
    return any(kw in (data.get(field) or "") for field in ("iccid", "iccid2", "backupIccid"))


def _match_device(data: dict, mac: str = "", imei: str = "", iccid: str = "") -> bool:
    if mac.strip() and not _match_mac(data.get("mac", ""), mac):
        return False
    if imei.strip() and imei.strip() not in (data.get("imei") or ""):
        return False
    if iccid.strip() and not _match_iccid(data, iccid):
        return False
    return True


def _match_customer_keyword(data: dict, keyword: str) -> bool:
    kw = keyword.strip()
    if not kw:
        return True
    return (
        kw in data.get("customerName", "")
        or kw in data.get("storeName", "")
        or kw in data.get("phone", "")
        or kw in data.get("contact", "")
        or kw in data.get("contactPhone", "")
    )


def _has_device_search(keyword: str = "", mac: str = "", imei: str = "", iccid: str = "") -> bool:
    return any(value.strip() for value in (keyword, mac, imei, iccid))


def _matches_customer_search(
    data: dict,
    keyword: str = "",
    mac: str = "",
    imei: str = "",
    iccid: str = "",
) -> bool:
    if not _has_device_search(keyword, mac, imei, iccid):
        return True
    name_hit = _match_customer_keyword(data, keyword)
    device_fields = (mac, imei, iccid)
    if any(value.strip() for value in device_fields):
        device_hit = _match_device(data, mac, imei, iccid)
        if keyword.strip():
            return name_hit and device_hit
        return device_hit
    return name_hit


def _order_to_customer_item(db: Session, order: WorkOrder) -> dict:
    data = {
        "id": order.customer_id or 0,
        "workOrderId": order.id,
        "storeName": order.store_name,
        "customerName": order.customer_name,
        "contact": order.contact,
        "phone": order.contact_phone,
        "address": order.address,
        "salesName": order.sales_name,
        "contactStatus": "",
        "orderNo": order.order_no,
        "installDate": order.install_date,
        "deviceSupplier": order.device_supplier,
        "deviceModel": order.device_model,
        "mac": order.mac,
        "imei": order.imei,
        "simSupplier": order.sim_supplier,
        "operator": order.operator,
        "iccid": order.iccid,
        "backupIccid": order.backup_iccid,
        "iccid2": order.backup_iccid,
        "price": order.price,
    }
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            data["contactStatus"] = customer.contact_status
            data["lastFollowTime"] = customer.last_follow_time
    return _serialize_customer(data)


def resolve_customer_id(db: Session, body: dict, sales_name: str = "") -> int | None:
    cid = body.get("customerId")
    if cid:
        row = db.query(Customer).filter(Customer.id == cid).first()
        if row:
            return int(cid)
    order_no = body.get("orderNo", "")
    if order_no:
        row = db.query(Customer).filter(Customer.order_no == order_no, Customer.owner_status != "pending").first()
        if row:
            return row.id
    phone = (body.get("phone") or body.get("contactPhone") or "").strip()
    if phone:
        row = db.query(Customer).filter(Customer.phone == phone, Customer.owner_status != "pending").first()
        if row:
            return row.id
    name = (body.get("customerName") or body.get("storeName") or "").strip()
    if name and sales_name:
        row = (
            db.query(Customer)
            .filter(Customer.sales_name == sales_name, Customer.customer_name == name)
            .first()
        )
        if row:
            return row.id
    return None


def link_order_to_customer(db: Session, customer_id: int, order: WorkOrder) -> None:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return
    customer.order_no = order.order_no
    order.customer_id = customer_id


def sync_customer_from_order(db: Session, order: WorkOrder) -> None:
    customer: Customer | None = None
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if not customer and order.order_no:
        customer = db.query(Customer).filter(Customer.order_no == order.order_no).first()
    if not customer:
        customer = (
            db.query(Customer)
            .filter(
                Customer.sales_name == order.sales_name,
                Customer.customer_name == order.customer_name,
            )
            .first()
        )
    if not customer and order.contact_phone:
        customer = db.query(Customer).filter(Customer.phone == order.contact_phone).first()

    patch = device_patch_from_order(order)
    if customer:
        customer.order_no = order.order_no
        customer.install_date = patch["installDate"] or customer.install_date
        customer.device_supplier = patch["deviceSupplier"] or customer.device_supplier
        customer.device_model = patch["deviceModel"] or customer.device_model
        customer.mac = patch["mac"] or customer.mac
        customer.imei = patch["imei"] or customer.imei
        customer.sim_supplier = patch["simSupplier"] or customer.sim_supplier
        customer.operator = patch["operator"] or customer.operator
        customer.iccid = patch["iccid"] or customer.iccid
        customer.backup_iccid = patch["backupIccid"] or customer.backup_iccid
        if order.price:
            customer.price = order.price
        order.customer_id = customer.id
        return

    customer = Customer(
        store_name=order.store_name,
        customer_name=order.customer_name,
        contact=order.contact,
        phone=order.contact_phone,
        address=order.address,
        sales_name=order.sales_name,
        contact_status="正常",
        order_no=order.order_no,
        install_date=patch["installDate"],
        device_supplier=patch["deviceSupplier"],
        device_model=patch["deviceModel"],
        mac=patch["mac"],
        imei=patch["imei"],
        sim_supplier=patch["simSupplier"],
        operator=patch["operator"],
        iccid=patch["iccid"],
        backup_iccid=patch["backupIccid"],
        source="安装登记",
        claim_time=_now_str(),
    )
    db.add(customer)
    db.flush()
    order.customer_id = customer.id


def update_customer_follow_meta(db: Session, customer_id: int, last_follow_time: str) -> None:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return
    customer.last_follow_time = last_follow_time
    if customer.contact_status == "待跟进":
        customer.contact_status = "正常"


def link_customer_finance(db: Session, order_no: str, finance_id: int) -> None:
    customer = db.query(Customer).filter(Customer.order_no == order_no).first()
    if customer:
        customer.finance_id = finance_id


def sync_finance_customer(db: Session, finance_id: int, order_no: str) -> None:
    """账单改挂工单号时，摘掉不再对应该工单的客户。"""
    order_no = (order_no or "").strip()
    holders = db.query(Customer).filter(Customer.finance_id == finance_id).all()
    for holder in holders:
        if (holder.order_no or "") != order_no:
            holder.finance_id = None
    if order_no:
        link_customer_finance(db, order_no, finance_id)


def update_customer_payment(
    db: Session,
    order_no: str,
    last_payment_time: str,
    last_payment_amount: float,
) -> None:
    customer = db.query(Customer).filter(Customer.order_no == order_no).first()
    if customer:
        customer.last_payment_time = last_payment_time
        customer.last_payment_amount = last_payment_amount


def list_customers(
    db: Session,
    keyword: str = "",
    sales_name: str = "",
    contact_status: str = "",
    invoice_type: str = "",
    order_no: str = "",
    mac: str = "",
    imei: str = "",
    iccid: str = "",
    operator: str = "",
    installed: str = "",
    has_payment: str = "",
    sales_names: list[str] | None = None,
) -> dict:
    if sales_names is not None and len(sales_names) == 0:
        return {"list": [], "total": 0}

    q = db.query(Customer).filter(Customer.owner_status != "pending")
    if sales_names is not None:
        q = q.filter(Customer.sales_name.in_(sales_names))
    elif sales_name:
        q = q.filter(Customer.sales_name.contains(sales_name))
    if contact_status:
        q = q.filter(Customer.contact_status == contact_status)
    if invoice_type:
        q = q.filter(Customer.invoice_type == invoice_type)
    if order_no:
        q = q.filter(Customer.order_no.contains(order_no))
    if operator:
        q = q.filter(Customer.operator.contains(operator))
    rows = q.all()
    items = [_enrich_customer(db, c) for c in rows]

    if installed == "yes":
        items = [c for c in items if c.get("installDate") or c.get("mac")]
    elif installed == "no":
        items = [c for c in items if not c.get("installDate") and not c.get("mac")]
    if has_payment == "yes":
        items = [c for c in items if (c.get("paidAmount") or 0) > 0]
    elif has_payment == "no":
        items = [c for c in items if not (c.get("paidAmount") or 0)]

    device_search = _has_device_search(keyword, mac, imei, iccid)
    if device_search:
        result = [c for c in items if _matches_customer_search(c, keyword, mac, imei, iccid)]
    else:
        result = list(items)
        if keyword:
            result = [
                c for c in result
                if keyword in c.get("customerName", "")
                or keyword in c.get("storeName", "")
                or keyword in c.get("phone", "")
                or keyword in c.get("contact", "")
            ]
        if mac:
            result = [c for c in result if _match_mac(c.get("mac", ""), mac)]
        if imei:
            result = [c for c in result if imei in (c.get("imei") or "")]
        if iccid:
            result = [c for c in result if _match_iccid(c, iccid)]

    if device_search:
        existing_orders = {item.get("orderNo") for item in result if item.get("orderNo")}
        existing_ids = {item.get("id") for item in result if item.get("id")}
        order_q = db.query(WorkOrder)
        if sales_names is not None:
            order_q = order_q.filter(WorkOrder.sales_name.in_(sales_names))
        elif sales_name:
            order_q = order_q.filter(WorkOrder.sales_name.contains(sales_name))
        allowed = set(sales_names or [])
        for order in order_q.all():
            if order.order_no in existing_orders:
                continue
            linked = db.query(Customer).filter(Customer.order_no == order.order_no).first()
            if linked and (linked.owner_status == "pending" or (allowed and linked.sales_name not in allowed)):
                continue
            if linked and linked.id in existing_ids:
                continue
            item = _order_to_customer_item(db, order)
            if _matches_customer_search(item, keyword, mac, imei, iccid):
                result.append(item)
                if order.order_no:
                    existing_orders.add(order.order_no)

    return {"list": result, "total": len(result)}


def get_customer(db: Session, customer_id: int) -> dict | None:
    row = db.query(Customer).filter(Customer.id == customer_id).first()
    return _enrich_customer(db, row) if row else None


def _build_customer_row(body: dict, *, source: str, claim_time: str = "") -> Customer:
    body = _normalize_customer_body(body)
    iccid2 = body.get("iccid2") or body.get("backupIccid") or ""
    return Customer(
        store_name=body["storeName"],
        customer_name=body["customerName"],
        contact=body.get("contact", ""),
        phone=body.get("phone", ""),
        address=body.get("address", ""),
        sales_name=body.get("salesName", ""),
        contact_status=body.get("contactStatus", "正常"),
        order_no=body.get("orderNo", ""),
        install_date=body.get("installDate", ""),
        device_supplier=body.get("deviceSupplier", ""),
        device_model=body.get("deviceModel", ""),
        mac=body.get("mac", ""),
        imei=body.get("imei", ""),
        iccid=body.get("iccid", ""),
        backup_iccid=iccid2,
        operator=body.get("operator", ""),
        sim_supplier=body.get("simSupplier", ""),
        contract_period=body.get("contractPeriod", ""),
        price=body.get("price", ""),
        invoice_type=body.get("invoiceType", ""),
        claim_time=claim_time,
        wechat_id=body.get("wechatId", ""),
        source=source,
        id_card_front=body.get("idCardFront", ""),
        id_card_back=body.get("idCardBack", ""),
    )


def create_customer(db: Session, body: dict, sales_name: str = "") -> dict:
    body = _normalize_customer_body(body)
    if not body.get("storeName") or not body.get("customerName"):
        raise BizError("店名和客户名称为必填项")
    if body.get("phone"):
        _validate_phone(body["phone"])
    if body.get("contactStatus") and body["contactStatus"] not in _CONTACT_STATUSES:
        raise BizError("联系状态无效")
    sales = (sales_name or body.get("salesName") or "").strip()
    if not sales:
        raise BizError("负责销售为必填项")
    row = _build_customer_row(
        {
            **body,
            "salesName": sales,
            "contactStatus": "待跟进" if sales else body.get("contactStatus", "正常"),
        },
        source=body.get("source", "自建" if sales else "手动"),
        claim_time=_now_str() if sales else body.get("claimTime", ""),
    )
    row.owner_status = "confirmed"
    row.owner_note = ""
    db.add(row)
    db.commit()
    db.refresh(row)
    return _enrich_customer(db, row)


def update_customer(db: Session, body: dict) -> dict:
    body = _normalize_customer_body(body)
    cid = body.get("id")
    row = _get_customer_row(db, cid)
    if body.get("phone"):
        _validate_phone(body["phone"])
    if body.get("contactStatus") and body["contactStatus"] not in _CONTACT_STATUSES:
        raise BizError("联系状态无效")
    field_map = {
        "storeName": "store_name", "customerName": "customer_name", "contact": "contact",
        "phone": "phone", "address": "address",
        "contactStatus": "contact_status", "orderNo": "order_no", "installDate": "install_date",
        "deviceSupplier": "device_supplier", "deviceModel": "device_model", "mac": "mac",
        "imei": "imei", "iccid": "iccid", "operator": "operator", "simSupplier": "sim_supplier",
        "contractPeriod": "contract_period", "price": "price", "invoiceType": "invoice_type", "wechatId": "wechat_id",
        "idCardFront": "id_card_front", "idCardBack": "id_card_back",
    }
    for api_key, attr in field_map.items():
        if api_key in body:
            setattr(row, attr, body[api_key])
    if "iccid2" in body or "backupIccid" in body:
        row.backup_iccid = body.get("iccid2") or body.get("backupIccid") or ""
    db.commit()
    db.refresh(row)
    return _enrich_customer(db, row)


def delete_customer(db: Session, customer_id: int) -> bool:
    row = _get_customer_row(db, customer_id)
    db.delete(row)
    db.commit()
    return True


def import_customers(db: Session, rows: list) -> dict:
    if not rows:
        raise BizError("导入数据为空")
    new_items = []
    for idx, row in enumerate(rows, start=2):
        body = _normalize_customer_body(dict(row))
        if not body.get("storeName") or not body.get("customerName"):
            raise BizError(f"第 {idx} 行：店名和客户名称为必填项")
        try:
            if body.get("phone"):
                _validate_phone(body["phone"])
        except BizError as exc:
            raise BizError(f"第 {idx} 行：{exc.message}") from exc
        if body.get("contactStatus") and body["contactStatus"] not in _CONTACT_STATUSES:
            raise BizError(f"第 {idx} 行：联系状态无效")
        from app.services.customer_owner import require_unique_sales

        try:
            sales = require_unique_sales(db, body.get("salesName", "")).name
        except BizError as exc:
            raise BizError(f"第 {idx} 行：{exc.message}") from exc
        body["salesName"] = sales
        item = _build_customer_row(body, source="导入")
        item.owner_status = "confirmed"
        item.owner_note = ""
        db.add(item)
        new_items.append(item)
    db.commit()
    for item in new_items:
        db.refresh(item)
    return {"count": len(new_items), "list": [_enrich_customer(db, c) for c in new_items]}


def _cell(body: dict, key: str) -> str:
    return str(body.get(key) or "").strip()


def _add_imported_follow(
    db: Session,
    customer: Customer,
    body: dict,
    user_id: int,
    sales_name: str,
    idx: int,
) -> None:
    content = _cell(body, "followContent")
    if not content:
        return
    if not (customer.store_name or "").strip():
        raise BizError(f"第 {idx} 行：跟进记录缺少店名")
    follow_type = _cell(body, "followType") or "电话"
    if follow_type not in _FOLLOW_TYPES:
        raise BizError(f"第 {idx} 行：跟进方式无效")
    next_plan = _cell(body, "nextPlan")
    now = _now_str()
    db.add(
        FollowUp(
            user_id=user_id,
            customer_id=customer.id,
            customer_name=customer.customer_name,
            store_name=customer.store_name,
            sales_name=sales_name,
            type=follow_type,
            content=content,
            next_plan=next_plan,
            status="待完成" if next_plan else "已完成",
            create_time=now,
        )
    )
    customer.last_follow_time = now


def import_my_customers(db: Session, rows: list, sales_name: str, user_id: int = 0) -> dict:
    if not rows:
        raise BizError("导入数据为空")
    from app.services.customer_owner import require_unique_sales

    sales_name = require_unique_sales(db, sales_name).name
    now = _now_str()
    new_items = []
    last_customer = None
    for idx, row in enumerate(rows, start=2):
        body = _normalize_customer_body(dict(row))
        for key in ("storeName", "customerName", "contact", "phone", "address", "followType", "followContent", "nextPlan"):
            if key in body:
                body[key] = _cell(body, key)
        follow_content = _cell(body, "followContent")
        if not body.get("storeName") or not body.get("customerName"):
            same_customer = last_customer is not None and (
                not body.get("customerName") or body.get("customerName") == last_customer.customer_name
            )
            if follow_content and same_customer:
                _add_imported_follow(db, last_customer, body, user_id, sales_name, idx)
                continue
            if follow_content and not body.get("storeName"):
                raise BizError(f"第 {idx} 行：跟进记录缺少店名")
            raise BizError(f"第 {idx} 行：店名和客户名称为必填项")
        try:
            if body.get("phone"):
                _validate_phone(body["phone"])
        except BizError as exc:
            raise BizError(f"第 {idx} 行：{exc.message}") from exc
        item = _build_customer_row(
            {
                "storeName": body["storeName"],
                "customerName": body["customerName"],
                "contact": body.get("contact", ""),
                "phone": body.get("phone", ""),
                "address": body.get("address", ""),
                "salesName": sales_name,
                "contactStatus": "待跟进",
            },
            source="导入",
            claim_time=now,
        )
        item.owner_status = "confirmed"
        item.owner_note = ""
        db.add(item)
        db.flush()
        new_items.append(item)
        last_customer = item
        if follow_content:
            _add_imported_follow(db, item, body, user_id, sales_name, idx)
    db.commit()
    for item in new_items:
        db.refresh(item)
    return {"count": len(new_items), "list": [_enrich_customer(db, c) for c in new_items]}


# --- 公海 / 联系人 / 公海配置（DB 持久化） ---

DEFAULT_POOL_CONFIG = {
    "poolName": "默认公海池",
    "poolDescription": "全国宽带业务默认公海客户池",
    "returnDays": 7,
    "notifyBeforeReturn": True,
    "enabled": True,
}


def _pool_to_dict(row: PublicPoolCustomer) -> dict:
    return {
        "id": row.id,
        "storeName": row.store_name,
        "customerName": row.customer_name,
        "contact": row.contact,
        "phone": row.phone,
        "address": row.address,
        "source": row.source,
        "status": row.status,
    }


def _contact_to_dict(row: Contact) -> dict:
    return {
        "id": row.id,
        "customerName": row.customer_name,
        "storeName": row.store_name,
        "name": row.name,
        "phone": row.phone,
        "title": row.title,
        "isPrimary": row.is_primary,
    }


def list_public_pool(db: Session, keyword: str = "") -> dict:
    q = db.query(PublicPoolCustomer).filter(PublicPoolCustomer.status == "在公海")
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(
            PublicPoolCustomer.customer_name.like(kw)
            | PublicPoolCustomer.store_name.like(kw)
        )
    rows = q.order_by(PublicPoolCustomer.id.desc()).all()
    items = [_pool_to_dict(r) for r in rows]
    return {"list": items, "total": len(items)}


def create_public_pool_customer(db: Session, body: dict) -> dict:
    if not body.get("storeName") or not body.get("customerName"):
        raise BizError("店名和客户名称为必填项")
    if body.get("phone"):
        _validate_phone(body["phone"])
    row = PublicPoolCustomer(
        store_name=body["storeName"],
        customer_name=body["customerName"],
        contact=body.get("contact", ""),
        phone=body.get("phone", ""),
        address=body.get("address", ""),
        source=body.get("source", "手动"),
        status="在公海",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _pool_to_dict(row)


def import_public_pool(db: Session, rows: list) -> dict:
    if not rows:
        raise BizError("导入数据为空")
    new_rows = []
    for idx, raw in enumerate(rows, start=2):
        body = dict(raw or {})
        if not body.get("storeName") or not body.get("customerName"):
            raise BizError(f"第 {idx} 行：店名和客户名称为必填项")
        try:
            if body.get("phone"):
                _validate_phone(str(body["phone"]).strip())
        except BizError as exc:
            raise BizError(f"第 {idx} 行：{exc.message}") from exc
        row = PublicPoolCustomer(
            store_name=str(body["storeName"]).strip(),
            customer_name=str(body["customerName"]).strip(),
            contact=str(body.get("contact") or "").strip(),
            phone=str(body.get("phone") or "").strip(),
            address=str(body.get("address") or "").strip(),
            source="导入",
            status="在公海",
        )
        db.add(row)
        db.flush()
        new_rows.append(row)
    db.commit()
    items = [_pool_to_dict(r) for r in new_rows]
    return {"count": len(items), "list": items}


def claim_public_pool(db: Session, customer_id: int, sales_name: str) -> dict:
    from app.services.customer_owner import require_unique_sales

    sales_name = require_unique_sales(db, sales_name).name
    row = db.query(PublicPoolCustomer).filter(PublicPoolCustomer.id == customer_id).first()
    if not row:
        raise BizError("客户不存在")
    if row.status != "在公海":
        raise BizError("该客户已被领取")
    row.status = "已领取"
    db.commit()
    return create_customer(
        db,
        {
            "storeName": row.store_name,
            "customerName": row.customer_name,
            "contact": row.contact,
            "phone": row.phone,
            "address": row.address,
            "source": "公海领取",
        },
        sales_name=sales_name,
    )


def return_to_public_pool(db: Session, body: dict, sales_name: str = "") -> bool:
    cid = body.get("id")
    item = get_customer(db, cid)
    if not item:
        raise BizError("客户不存在")
    delete_customer(db, cid)
    db.add(PublicPoolCustomer(
        store_name=item.get("storeName", ""),
        customer_name=item.get("customerName", ""),
        contact=item.get("contact", ""),
        phone=item.get("phone", ""),
        address=body.get("address", item.get("address", "")),
        source="退回",
        status="在公海",
    ))
    db.add(ReturnLog(
        customer_name=item.get("customerName", ""),
        store_name=item.get("storeName", ""),
        sales_name=sales_name or item.get("salesName", ""),
        reason=body.get("reason", "手动退回"),
        return_time=_now_str(),
    ))
    db.commit()
    return True


def list_contacts(db: Session, keyword: str = "") -> dict:
    q = db.query(Contact)
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(
            Contact.name.like(kw)
            | Contact.customer_name.like(kw)
            | Contact.phone.like(kw)
        )
    rows = q.order_by(Contact.id.desc()).all()
    items = [_contact_to_dict(r) for r in rows]
    return {"list": items, "total": len(items)}


def _demote_other_primaries(db: Session, customer_name: str, keep_id: int | None = None) -> None:
    q = db.query(Contact).filter(Contact.customer_name == customer_name, Contact.is_primary.is_(True))
    if keep_id is not None:
        q = q.filter(Contact.id != keep_id)
    for other in q.all():
        other.is_primary = False


def create_contact(db: Session, body: dict) -> dict:
    if not body.get("name") or not body.get("customerName"):
        raise BizError("客户名称和姓名为必填项")
    if body.get("phone"):
        _validate_phone(body["phone"])
    row = Contact(
        customer_name=body.get("customerName", ""),
        store_name=body.get("storeName", ""),
        name=body.get("name", ""),
        phone=body.get("phone", ""),
        title=body.get("title", ""),
        is_primary=bool(body.get("isPrimary")),
    )
    db.add(row)
    db.flush()
    if row.is_primary:
        _demote_other_primaries(db, row.customer_name, keep_id=row.id)
    db.commit()
    db.refresh(row)
    return _contact_to_dict(row)


def update_contact(db: Session, body: dict) -> dict:
    row = db.query(Contact).filter(Contact.id == body.get("id")).first()
    if not row:
        raise BizError("联系人不存在")
    if body.get("phone"):
        _validate_phone(body["phone"])
    for api_key, attr in (
        ("customerName", "customer_name"),
        ("storeName", "store_name"),
        ("name", "name"),
        ("phone", "phone"),
        ("title", "title"),
    ):
        if api_key in body and body[api_key] is not None:
            setattr(row, attr, body[api_key])
    if "isPrimary" in body:
        row.is_primary = bool(body["isPrimary"])
    if row.is_primary:
        _demote_other_primaries(db, row.customer_name, keep_id=row.id)
    db.commit()
    db.refresh(row)
    return _contact_to_dict(row)


def import_contacts(db: Session) -> dict:
    row = Contact(
        customer_name="导入客户示例",
        store_name="示例门店",
        name="导入联系人",
        phone="13800138888",
        title="经理",
        is_primary=True,
    )
    db.add(row)
    db.commit()
    return {"count": 1}


def get_pool_config(db: Session) -> dict:
    from app.services.settings_service import get_setting

    return get_setting(db, "pool_config", DEFAULT_POOL_CONFIG)


def update_pool_config(db: Session, body: dict) -> dict:
    from app.services.settings_service import put_setting

    return put_setting(db, "pool_config", {**get_pool_config(db), **body}, DEFAULT_POOL_CONFIG)


def list_return_logs(db: Session) -> dict:
    rows = db.query(ReturnLog).order_by(ReturnLog.id.desc()).all()
    items = [{
        "id": r.id,
        "customerName": r.customer_name,
        "storeName": r.store_name,
        "salesName": r.sales_name,
        "reason": r.reason,
        "returnTime": r.return_time,
    } for r in rows]
    return {"list": items, "total": len(items)}


def _parse_activity_time(customer: Customer) -> datetime | None:
    for raw in (customer.last_follow_time, customer.claim_time):
        text = (raw or "").strip()
        if not text:
            continue
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(text[:16] if " " in text else text[:10], fmt)
            except ValueError:
                continue
    if customer.created_at:
        dt = customer.created_at
        return dt.replace(tzinfo=None) if dt.tzinfo else dt
    return None


def auto_return_stale_customers(db: Session) -> dict:
    """按公海池配置扫描私海客户，超期未跟进则自动退回。"""
    config = get_pool_config(db)
    if not config.get("enabled"):
        return {"count": 0, "list": [], "skipped": True, "reason": "自动退回未启用"}

    return_days = int(config.get("returnDays") or 0)
    if return_days < 1:
        return {"count": 0, "list": [], "skipped": True, "reason": "退回天数无效"}

    notify_before = bool(config.get("notifyBeforeReturn"))
    now = datetime.now()
    # 未成交私海客户：有归属销售、尚无工单
    candidates = (
        db.query(Customer)
        .filter(Customer.sales_name != "", Customer.order_no == "")
        .all()
    )

    returned = []
    for customer in candidates:
        activity = _parse_activity_time(customer)
        if not activity:
            continue
        idle_days = (now - activity).days
        if idle_days < return_days:
            continue

        reason = f"{return_days}天未跟进自动退回"
        body = {
            "id": customer.id,
            "customerName": customer.customer_name,
            "storeName": customer.store_name,
            "address": customer.address,
            "reason": reason,
        }
        sales_name = customer.sales_name
        customer_id = customer.id

        if notify_before and sales_name:
            sales_user = (
                db.query(User)
                .filter(User.name == sales_name, User.enabled.is_(True))
                .first()
            )
            if sales_user:
                notify_service.send_from_template(
                    db,
                    user_id=sales_user.id,
                    template_code="pool_auto_return",
                    context={
                        "customer_name": body["customerName"],
                        "store_name": body["storeName"],
                        "days": return_days,
                    },
                    source_type="customer",
                    source_id=customer_id,
                    dedupe=True,
                )

        return_to_public_pool(db, body, sales_name)
        returned.append({
            "customerName": body["customerName"],
            "storeName": body["storeName"],
            "salesName": sales_name,
            "idleDays": idle_days,
            "reason": reason,
        })

    return {"count": len(returned), "list": returned, "skipped": False}
