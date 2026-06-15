import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.data.store import store
from app.db.models import Customer, WorkOrder
from app.db.serialize import customer_to_dict, device_patch_from_order

_PHONE_RE = re.compile(r"^1\d{10}$")
_CONTACT_STATUSES = {"正常", "中断合作", "待跟进"}
_DEVICE_FIELDS = (
    "installDate", "deviceSupplier", "deviceModel", "mac", "imei",
    "simSupplier", "operator", "iccid", "backupIccid",
)
_UPDATABLE_FIELDS = {
    "storeName", "customerName", "contact", "phone", "address", "salesName",
    "contactStatus", "orderNo", "installDate", "deviceSupplier", "deviceModel",
    "mac", "imei", "iccid", "iccid2", "backupIccid", "operator", "simSupplier",
    "contractPeriod", "invoiceType", "wechatId",
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


def _find_finance(order_no: str) -> dict | None:
    if not order_no:
        return None
    return next((f for f in store.finance if f.get("orderNo") == order_no), None)


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
                ("iccid", "iccid"), ("backupIccid", "backup_iccid"),
            ]:
                if not data.get(field_camel) and getattr(order, field_snake, ""):
                    data[field_camel] = getattr(order, field_snake)
    finance = _find_finance(order_no)
    if finance:
        data.setdefault("financeId", finance.get("id"))
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
        if db.query(Customer).filter(Customer.id == cid).first():
            return int(cid)
    order_no = body.get("orderNo", "")
    if order_no:
        row = db.query(Customer).filter(Customer.order_no == order_no).first()
        if row:
            return row.id
    phone = (body.get("phone") or body.get("contactPhone") or "").strip()
    if phone:
        row = db.query(Customer).filter(Customer.phone == phone).first()
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
) -> dict:
    q = db.query(Customer)
    if sales_name:
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
        items = [c for c in items if c.get("lastPaymentTime")]
    elif has_payment == "no":
        items = [c for c in items if not c.get("lastPaymentTime")]

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
        if sales_name:
            order_q = order_q.filter(WorkOrder.sales_name.contains(sales_name))
        for order in order_q.all():
            if order.order_no in existing_orders:
                continue
            linked = db.query(Customer).filter(Customer.order_no == order.order_no).first()
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
        invoice_type=body.get("invoiceType", ""),
        claim_time=claim_time,
        wechat_id=body.get("wechatId", ""),
        source=source,
    )


def create_customer(db: Session, body: dict, sales_name: str = "") -> dict:
    body = _normalize_customer_body(body)
    if not body.get("storeName") or not body.get("customerName"):
        raise BizError("店名和客户名称为必填项")
    if body.get("phone"):
        _validate_phone(body["phone"])
    if body.get("contactStatus") and body["contactStatus"] not in _CONTACT_STATUSES:
        raise BizError("联系状态无效")
    sales = sales_name or body.get("salesName", "")
    row = _build_customer_row(
        {
            **body,
            "salesName": sales,
            "contactStatus": "待跟进" if sales else body.get("contactStatus", "正常"),
        },
        source=body.get("source", "自建" if sales else "手动"),
        claim_time=_now_str() if sales else body.get("claimTime", ""),
    )
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
        "phone": "phone", "address": "address", "salesName": "sales_name",
        "contactStatus": "contact_status", "orderNo": "order_no", "installDate": "install_date",
        "deviceSupplier": "device_supplier", "deviceModel": "device_model", "mac": "mac",
        "imei": "imei", "iccid": "iccid", "operator": "operator", "simSupplier": "sim_supplier",
        "contractPeriod": "contract_period", "invoiceType": "invoice_type", "wechatId": "wechat_id",
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
        item = _build_customer_row(body, source="导入")
        db.add(item)
        new_items.append(item)
    db.commit()
    for item in new_items:
        db.refresh(item)
    return {"count": len(new_items), "list": [_enrich_customer(db, c) for c in new_items]}


def import_my_customers(db: Session, rows: list, sales_name: str) -> dict:
    if not rows:
        raise BizError("导入数据为空")
    if not sales_name:
        raise BizError("销售姓名不能为空")
    now = _now_str()
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
        db.add(item)
        new_items.append(item)
    db.commit()
    for item in new_items:
        db.refresh(item)
    return {"count": len(new_items), "list": [_enrich_customer(db, c) for c in new_items]}


# --- 公海 / 联系人等仍使用内存 store ---

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


def claim_public_pool(db: Session, customer_id: int, sales_name: str) -> dict:
    item = next((c for c in store.public_pool if c["id"] == customer_id), None)
    if not item:
        raise BizError("客户不存在")
    if item.get("status") != "在公海":
        raise BizError("该客户已被领取")
    store.public_pool = [
        {**c, "status": "已领取", "salesName": sales_name} if c["id"] == customer_id else c
        for c in store.public_pool
    ]
    row = create_customer(
        db,
        {
            "storeName": item.get("storeName", ""),
            "customerName": item.get("customerName", ""),
            "contact": item.get("contact", ""),
            "phone": item.get("phone", ""),
            "address": item.get("address", ""),
            "source": "公海领取",
        },
        sales_name=sales_name,
    )
    return row


def return_to_public_pool(db: Session, body: dict, sales_name: str = "") -> bool:
    cid = body.get("id")
    item = get_customer(db, cid)
    if not item:
        raise BizError("客户不存在")
    delete_customer(db, cid)
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
            {**c, "isPrimary": False}
            if c.get("customerName") == updated["customerName"] and c["id"] != cid else c
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
