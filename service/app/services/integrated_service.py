import json
import re
from datetime import datetime, timedelta

from sqlalchemy import or_
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import Contact, Contract, Customer, Finance, SimStockIn, StockIn, StockOut, User, WorkOrder
from app.services import customer_service as customer_svc
from app.services.contract_service import _gen_contract_no
from app.services.finance_service import _build_finance_row, finance_to_dict
from app.services.stock_service import _apply_out_deduction, _gen_in_no, _gen_out_no
from app.services.work_order_service import _append_log
from app.utils.contract_status import canon_contract_status, resolve_contract_status
from app.utils.finance_calc import calc_payment_status

_PAREN_RE = re.compile(r"^(.*?)\s*[（(]\s*(.*?)\s*[)）]\s*$")
_DATE_RE = re.compile(r"(\d{4})\D(\d{1,2})\D(\d{1,2})")
_EXCEL_SERIAL_RE = re.compile(r"\d{5}(?:\.0+)?")
_INVOICE_MAP = {
    "专票": "增值税专用发票",
    "普票": "增值税普通发票",
    "不开票": "不开发票",
}
_INVOICE_SKIP = {"专票/普票", "专票／普票"}
_PAYMENT_MAP = {
    "已回": "已回款",
    "已收款": "已回款",
    "未回": "未回款",
    "未收款": "未回款",
}
DEFAULT_IMPORT_SALES = "扬琴"


def _year_month(value: str) -> tuple[int, int] | None:
    text = (value or "").strip().replace("月", "")
    matched = re.search(r"(\d{4})\D+(\d{1,2})", text)
    if matched:
        year, month = int(matched.group(1)), int(matched.group(2))
        if 1 <= month <= 12:
            return year, month
        return None
    only = re.fullmatch(r"(\d{1,2})", text)
    if only and 1 <= int(only.group(1)) <= 12:
        return 0, int(only.group(1))
    return None


def _match_bill_month(value: str, query: str) -> bool:
    """账单月按年月匹配。单独的 6 / 06 / 6月 只匹配月份，避免 6 命中所有 2026 年。"""
    raw = (value or "").strip()
    q = (query or "").strip()
    if not q:
        return True
    if not raw:
        return False
    full = re.fullmatch(r"(\d{4})\D+(\d{1,2})月?", q)
    if full:
        year, month = int(full.group(1)), int(full.group(2))
        return _year_month(raw) == (year, month) if 1 <= month <= 12 else False
    bare = re.fullmatch(r"(\d{1,2})月?", q)
    if bare and 1 <= int(bare.group(1)) <= 12:
        found = _year_month(raw)
        return found is not None and found[1] == int(bare.group(1))
    return q in raw


_INVOICE_SAME = {
    "不开票": "不开发票",
    "不开发票": "不开发票",
}


def _same_invoice(value: str, query: str) -> bool:
    left = _INVOICE_SAME.get(value, value)
    right = _INVOICE_SAME.get(query, query)
    return left == right


def _contains(value: str, keyword: str) -> bool:
    def fold(text: str) -> str:
        return (text or "").replace("(", "（").replace(")", "）").casefold()

    return fold(keyword) in fold(value)


def _asset_health(contact_status: str, mac: str, order_no: str) -> str:
    if contact_status == "中断合作":
        return "离线预警"
    if order_no and not mac:
        return "离线预警"
    return "正常"


def _device_field(order: WorkOrder | None, customer: Customer | None, field_order: str, field_customer: str) -> str:
    if order:
        val = getattr(order, field_order, "") or ""
        if val:
            return val
    if customer:
        return getattr(customer, field_customer, "") or ""
    return ""


def list_integrated(
    db: Session,
    keyword: str = "",
    sales_names: list[str] | None = None,
    sales_name: str = "",
    bill_month: str = "",
    payment_status: str = "",
    invoice_status: str = "",
    contract_status: str = "",
) -> dict:
    customers = db.query(Customer).all()
    customer_by_order = {c.order_no: c for c in customers if c.order_no}
    orders = db.query(WorkOrder).all()
    order_by_no = {o.order_no: o for o in orders if o.order_no}

    contracts = db.query(Contract).all()
    contract_by_order = {c.order_no: c for c in contracts if c.order_no}
    out_by_order: dict[str, StockOut] = {}
    for out in db.query(StockOut).order_by(StockOut.id).all():
        if out.order_no:
            out_by_order[out.order_no] = out
    finance_rows = [finance_to_dict(r) for r in db.query(Finance).order_by(Finance.id).all()]
    items: list[dict] = []
    for fin in finance_rows:
        order_no = fin.get("orderNo") or ""
        customer = customer_by_order.get(order_no)
        order = order_by_no.get(order_no)

        contact_status = (
            (customer.contact_status if customer else "")
            or fin.get("contactStatus")
            or "正常"
        )
        mac = _device_field(order, customer, "mac", "mac")
        contract = contract_by_order.get(order_no)
        period = fin.get("contractPeriod", "") or (customer.contract_period if customer else "")
        end_src = (contract.end_date if contract and contract.end_date else "") or period
        base_status = fin.get("contractStatus") or "正常"
        out = out_by_order.get(order_no)
        iccid = _device_field(order, customer, "iccid", "iccid")
        backup = _device_field(order, customer, "backup_iccid", "backup_iccid")
        operator = _device_field(order, customer, "operator", "operator")
        telecom = (out.telecom_no if out else "") or ""
        mobile = (out.mobile_no if out else "") or ""
        if not telecom and not mobile:
            if "移动" in operator and "电信" not in operator:
                mobile, telecom = iccid, backup
            else:
                telecom, mobile = iccid, backup
        elif not mobile:
            mobile = backup
        elif not telecom:
            telecom = backup

        raw_store = fin.get("storeName") or (customer.store_name if customer else "")
        raw_customer = fin.get("customerName") or (customer.customer_name if customer else "")
        contact = (order.contact if order and order.contact else "") or (customer.contact if customer else "")
        phone = (order.contact_phone if order and order.contact_phone else "") or (customer.phone if customer else "")
        item = {
            "id": fin.get("id"),
            "salesName": fin.get("salesName") or (customer.sales_name if customer else ""),
            "storeName": _display_store_name(raw_store, raw_customer, contact, phone),
            "customerName": raw_customer,
            "contact": contact,
            "phone": phone,
            "contactStatus": contact_status,
            "orderNo": order_no,
            "installer": order.installer if order else "",
            "installDate": (order.install_date if order and order.install_date else "") or (customer.install_date if customer else ""),
            "deviceSupplier": _device_field(order, customer, "device_supplier", "device_supplier"),
            "deviceModel": _device_field(order, customer, "device_model", "device_model"),
            "deviceCost": _device_field(order, customer, "device_cost", "device_cost"),
            "mac": mac,
            "imei": _device_field(order, customer, "imei", "imei"),
            "assetHealth": _asset_health(contact_status, mac, order_no),
            "simSupplier": _device_field(order, customer, "sim_supplier", "sim_supplier"),
            "telecomNo": telecom,
            "mobileNo": mobile,
            "oldCardNo": out.replaced_card_no if out else "",
            "cardCost": _device_field(order, customer, "card_cost", "card_cost"),
            "cardPackage": _device_field(order, customer, "card_package", "card_package"),
            "cardExpireDate": _device_field(order, customer, "card_expire_date", "card_expire_date"),
            "operator": operator,
            "iccid": iccid,
            "contractPeriod": period,
            "billMonth": fin.get("billMonth", ""),
            "price": (order.price if order and order.price else "") or (customer.price if customer else ""),
            "totalAmount": fin.get("totalAmount", 0),
            "paidAmount": fin.get("paidAmount", 0),
            "unpaidAmount": fin.get("unpaidAmount", 0),
            "paymentStatus": fin.get("paymentStatus", ""),
            "paymentPlanDate": fin.get("paymentPlanDate", ""),
            "invoiceStatus": fin.get("invoiceStatus", ""),
            "contractStatus": resolve_contract_status(end_src, base_status, keep_pending=False),
        }
        items.append(item)

    if sales_names is not None:
        allow = set(sales_names)
        items = [i for i in items if (i.get("salesName") or "") in allow]

    if keyword:
        kw = keyword.strip()
        items = [
            i for i in items
            if _contains(i.get("customerName") or "", kw)
            or _contains(i.get("orderNo") or "", kw)
            or _contains(i.get("storeName") or "", kw)
            or _contains(i.get("phone") or "", kw)
            or _contains(i.get("mac") or "", kw)
            or _contains(i.get("imei") or "", kw)
            or _contains(i.get("telecomNo") or "", kw)
            or _contains(i.get("mobileNo") or "", kw)
        ]
    if sales_name:
        name = sales_name.strip()
        items = [i for i in items if name in (i.get("salesName") or "")]
    if bill_month:
        items = [i for i in items if _match_bill_month(i.get("billMonth") or "", bill_month)]
    if payment_status:
        items = [i for i in items if (i.get("paymentStatus") or "") == payment_status]
    if invoice_status:
        items = [i for i in items if _same_invoice(i.get("invoiceStatus") or "", invoice_status)]
    if contract_status:
        items = [i for i in items if (i.get("contractStatus") or "") == contract_status]

    return {"list": items, "total": len(items)}


def get_integrated_item(db: Session, finance_id: int) -> dict:
    for item in list_integrated(db)["list"]:
        if item["id"] == finance_id:
            return item
    raise BizError("关联记录不存在")


def _text(value) -> str:
    return str(value or "").strip()


def _set(obj, attr: str, value: str) -> None:
    if obj is not None:
        setattr(obj, attr, value)


def update_integrated(db: Session, body: dict) -> dict:
    finance_id = int(body["id"])
    before = get_integrated_item(db, finance_id)
    fin = db.query(Finance).filter(Finance.id == finance_id).first()
    if not fin:
        raise BizError("关联记录不存在")
    store = _format_store_name(_text(body.get("storeName")))
    customer_name = _text(body.get("customerName"))
    if not store or not customer_name:
        raise BizError("店名和公司名称不能为空")
    phone = _text(body.get("phone"))
    if phone:
        customer_svc._validate_phone(phone)

    order_no = fin.order_no or ""
    customer = db.query(Customer).filter(Customer.order_no == order_no).first() if order_no else None
    order = db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first() if order_no else None
    contract = db.query(Contract).filter(Contract.order_no == order_no).first() if order_no else None
    sales = _text(body.get("salesName"))
    contact = _text(body.get("contact"))
    for obj in (customer, order, contract):
        _set(obj, "store_name", store)
        _set(obj, "customer_name", customer_name)
        if sales:
            _set(obj, "sales_name", sales)
    fin.store_name = store
    fin.customer_name = customer_name
    if sales:
        fin.sales_name = sales
    _set(customer, "contact", contact)
    _set(customer, "phone", phone)
    _set(customer, "contact_status", _text(body.get("contactStatus")) or "正常")
    _set(order, "contact", contact)
    _set(order, "contact_phone", phone)
    _set(order, "installer", _text(body.get("installer")))
    shared = {
        "install_date": _text(body.get("installDate")),
        "device_supplier": _text(body.get("deviceSupplier")),
        "device_model": _text(body.get("deviceModel")),
        "device_cost": _text(body.get("deviceCost")),
        "mac": _text(body.get("mac")),
        "imei": _text(body.get("imei")),
        "sim_supplier": _text(body.get("simSupplier")),
        "card_package": _text(body.get("cardPackage")),
        "card_cost": _text(body.get("cardCost")),
        "card_expire_date": _text(body.get("cardExpireDate")),
        "price": _text(body.get("price")),
        "contract_period": _text(body.get("contractPeriod")),
    }
    for obj in (customer, order):
        for attr, value in shared.items():
            _set(obj, attr, value)
    fin.contract_period = shared["contract_period"]
    bill_month = _text(body.get("billMonth"))
    if bill_month:
        fin.bill_month = bill_month
    invoice = _text(body.get("invoiceStatus"))
    if invoice:
        fin.invoice_status = invoice
    plan_date = _text(body.get("paymentPlanDate"))
    fin.payment_plan_date = plan_date
    total = float(body.get("totalAmount") or 0)
    calc = calc_payment_status(total, float(fin.paid_amount or 0), plan_date)
    fin.total_amount = total
    fin.unpaid_amount = calc["unpaidAmount"]
    fin.payment_status = calc["paymentStatus"]
    fin.payment_progress = calc["paymentProgress"]

    telecom = _text(body.get("telecomNo"))
    mobile = _text(body.get("mobileNo"))
    old_card = _text(body.get("oldCardNo"))
    card_changed = any(
        _text(body.get(key)) != _text(before.get(key))
        for key in ("telecomNo", "mobileNo", "oldCardNo")
    )
    out = db.query(StockOut).filter(StockOut.order_no == order_no).first() if order_no else None
    if out is not None:
        out.store_name = store
        out.customer_name = customer_name
        out.telecom_no = telecom
        out.mobile_no = mobile
        out.replaced_card_no = old_card
        if order is not None:
            out.model = order.device_model
            out.mac = order.mac
            out.imei = order.imei
    elif card_changed:
        operator = _text(body.get("operator")) or _device_field(order, customer, "operator", "operator")
        if "移动" in operator and "电信" not in operator:
            iccid, backup = mobile, telecom
        else:
            iccid, backup = telecom, mobile
        for obj in (customer, order):
            _set(obj, "iccid", iccid)
            _set(obj, "backup_iccid", backup)
    db.commit()
    return get_integrated_item(db, finance_id)


def _s(raw: dict, key: str) -> str:
    return str(raw.get(key) or "").strip()


def _split_paren(value: str) -> tuple[str, str]:
    m = _PAREN_RE.match(value)
    if not m:
        return value, ""
    return m.group(1).strip(), m.group(2).strip()


def _format_store_name(value: str) -> str:
    """店名统一为「门店名称（商场名）」。没有商场名时只留门店名称，没有门店名称时不编造。"""
    text = (value or "").strip()
    shop, mall = _split_paren(text)
    if shop and mall and _PAREN_RE.match(text):
        return f"{shop}（{mall}）"
    if shop and not mall:
        return shop
    return text


_COMPANY_HINTS = ("公司", "个体工商户", "有限合伙", "集团")


def _profile_incomplete(contact: str, phone: str) -> bool:
    return not (contact or "").strip() and not (phone or "").strip()


def _display_store_name(store: str, customer: str, contact: str, phone: str) -> str:
    """历史导入把门店名称和商场名拆进公司名称、店名时，展示时再合并。"""
    store = (store or "").strip()
    customer = (customer or "").strip()
    if "（" in store or "(" in store:
        return _format_store_name(store) if _PAREN_RE.match(store) else store
    company_like = any(hint in customer for hint in _COMPANY_HINTS) or "（" in customer or "(" in customer
    if (
        store
        and customer
        and customer != store
        and _profile_incomplete(contact, phone)
        and not company_like
    ):
        return f"{customer}（{store}）"
    return store


def _resolve_import_names(store_raw: str, company: str) -> tuple[str, str]:
    """识别到门店名称和商场名就写入组合店名，不因公司/联系人/手机号为空而拆开保存。"""
    store_name = _format_store_name(store_raw)
    company = (company or "").strip()
    if company:
        return company, store_name
    shop, mall = _split_paren(store_raw)
    if shop and mall and _PAREN_RE.match(store_raw):
        return shop, store_name
    return store_name, store_name


def _norm_date(value: str) -> str:
    value = (value or "").strip()
    if _EXCEL_SERIAL_RE.fullmatch(value):
        serial = int(float(value))
        if 20000 <= serial <= 80000:
            return (datetime(1899, 12, 30) + timedelta(days=serial)).strftime("%Y-%m-%d")
    short = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", value)
    if short:
        mo, d, y = (int(part) for part in short.groups())
        if y < 100:
            y += 2000
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y}-{mo:02d}-{d:02d}"
    m = _DATE_RE.search(value)
    if not m:
        return value
    y, mo, d = m.groups()
    return f"{y}-{int(mo):02d}-{int(d):02d}"


def _norm_invoice(value: str) -> str:
    value = (value or "").strip()
    if value in _INVOICE_SKIP:
        return ""
    return _INVOICE_MAP.get(value, value)


def _norm_contract_status(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    return canon_contract_status(value)


def _norm_payment_status(value: str) -> str:
    value = (value or "").strip()
    return _PAYMENT_MAP.get(value, value)


def _norm_period(value: str) -> str:
    dates = _DATE_RE.findall(value)
    if len(dates) >= 2:
        return " 至 ".join(f"{y}-{int(mo):02d}-{int(d):02d}" for y, mo, d in dates[:2])
    return value


def _to_amount(value: str) -> float:
    m = re.search(r"\d+(\.\d+)?", value.replace(",", ""))
    return float(m.group()) if m else 0.0


def _norm_month(value: str, ref_date: str = "") -> str:
    m = re.search(r"(\d{4})\D(\d{1,2})", value)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    only = re.fullmatch(r"\s*(\d{1,2})\s*月?\s*", value or "")
    ref = _DATE_RE.search(ref_date or "")
    if only and ref and 1 <= int(only.group(1)) <= 12:
        mo, ref_y, ref_mo = int(only.group(1)), int(ref.group(1)), int(ref.group(2))
        return f"{ref_y + 1 if mo < ref_mo else ref_y}-{mo:02d}"
    return value


_FIELD_LIMITS = (
    ("orderNo", "工单号", 32), ("contact", "联系人", 64), ("phone", "手机号", 20),
    ("installer", "安装人", 64), ("deviceSupplier", "设备商", 64), ("device", "设备型号", 64),
    ("deviceCost", "设备成本", 32), ("mac", "mac地址", 64), ("imei", "IMEI", 32),
    ("simSupplier", "卡商", 64), ("telecomNo", "电信卡号", 32), ("mobileNo", "移动卡号", 32),
    ("oldCardNo", "更换前旧卡号", 32), ("cardPackage", "卡套餐", 64), ("cardCost", "卡成本", 32),
    ("price", "售价", 64), ("storeName", "店名", 128), ("companyName", "公司名称", 128),
)


def _check_lengths(raw: dict) -> None:
    for key, label, limit in _FIELD_LIMITS:
        value = _s(raw, key)
        if len(value) > limit:
            raise BizError(f"{label}「{value[:40]}」超过 {limit} 个字符，请一格只填一个值")


def _norm_card_expire(value: str, ref_date: str) -> str:
    md = re.fullmatch(r"(\d{1,2})[/\-.月](\d{1,2})日?", value or "")
    ref = _DATE_RE.search(ref_date or "")
    if md and ref:
        mo, d = int(md.group(1)), int(md.group(2))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            y = int(ref.group(1))
            if (mo, d) < (int(ref.group(2)), int(ref.group(3))):
                y += 1
            return f"{y}-{mo:02d}-{d:02d}"
    result = _norm_date(value)
    if len(result) > 16:
        raise BizError(f"卡到期日「{result[:40]}」格式无法识别")
    return result


def _card_no(value: str) -> str:
    return "" if value in ("0", "-", "/", "无") else value


def _find_order(
    db: Session, order_no: str, mac: str, imei: str, cards: list[str],
    sales: str, customer_name: str, store_name: str,
):
    if order_no:
        return db.query(WorkOrder).filter(WorkOrder.order_no == order_no).first()
    conds = []
    if mac:
        conds.append(WorkOrder.mac == mac)
    if imei:
        conds.append(WorkOrder.imei == imei)
    for c in cards:
        conds += [WorkOrder.iccid == c, WorkOrder.backup_iccid == c]
    if conds:
        order = db.query(WorkOrder).filter(or_(*conds)).first()
        if order:
            return order
    return (
        db.query(WorkOrder)
        .filter(
            WorkOrder.sales_name == sales,
            WorkOrder.customer_name == customer_name,
            WorkOrder.store_name == store_name,
        )
        .first()
    )


def _resolve_amounts(raw: dict, order: WorkOrder, fin: Finance | None) -> tuple[float, float, str]:
    price_raw = _s(raw, "price")
    total_raw = _s(raw, "totalAmount")
    if total_raw:
        total = _to_amount(total_raw)
    elif price_raw:
        total = _to_amount(price_raw)
    elif fin is not None:
        total = float(fin.total_amount or 0)
    else:
        total = _to_amount(order.price or "")

    status = _norm_payment_status(_s(raw, "paymentStatus"))
    paid_raw = _s(raw, "paidAmount")
    if paid_raw:
        paid = _to_amount(paid_raw)
    elif status == "已回款":
        paid = total
    elif status in ("未回款", "已逾期") and fin is not None and float(fin.paid_amount or 0) > 0:
        paid = float(fin.paid_amount or 0)
        status = ""
    elif status in ("未回款", "已逾期"):
        paid = 0
    elif fin is not None:
        paid = float(fin.paid_amount or 0)
    else:
        paid = 0
    return total, paid, status


def _assign_payment(fin: Finance, total: float, paid: float, pay_status: str, paid_specified: bool) -> None:
    """有回款状态、又没有已收金额时，以表格里的状态为准。"""
    calc = calc_payment_status(total, paid, fin.payment_plan_date or "")
    fin.total_amount = total
    fin.paid_amount = paid
    fin.unpaid_amount = calc["unpaidAmount"]
    if pay_status and not paid_specified:
        fin.payment_status = pay_status
        if pay_status == "已回款":
            fin.payment_progress = 100
        elif pay_status == "未回款":
            fin.payment_progress = 0
        else:
            fin.payment_progress = calc["paymentProgress"]
        return
    fin.payment_status = calc["paymentStatus"]
    fin.payment_progress = calc["paymentProgress"]


def _upsert_finance(db: Session, order: WorkOrder, raw: dict, period: str) -> None:
    fin = db.query(Finance).filter(Finance.order_no == order.order_no).first()
    total, paid, pay_status = _resolve_amounts(raw, order, fin)
    ref_date = order.install_date or period
    bill_month = _norm_month(_s(raw, "billMonth"), ref_date) or (order.install_date[:7] if order.install_date else "")
    contract_status = _norm_contract_status(_s(raw, "contractStatus"))
    invoice = _norm_invoice(_s(raw, "invoiceType"))
    paid_specified = bool(_s(raw, "paidAmount"))

    if not fin:
        fin = _build_finance_row({
            "storeName": order.store_name,
            "customerName": order.customer_name,
            "orderNo": order.order_no,
            "billMonth": bill_month,
            "contractPeriod": period,
            "contractStatus": contract_status or "正常",
            "totalAmount": total,
            "paidAmount": paid,
            "invoiceStatus": invoice or "待开票",
            "lastPaymentTime": order.install_date if paid > 0 else "",
            "salesName": order.sales_name,
        })
        db.add(fin)
        db.flush()
    else:
        fin.store_name = order.store_name
        fin.customer_name = order.customer_name
        fin.sales_name = order.sales_name
        fin.bill_month = bill_month or fin.bill_month
        fin.contract_period = period or fin.contract_period
        fin.contract_status = contract_status or fin.contract_status
        if invoice:
            fin.invoice_status = invoice
    _assign_payment(fin, total, paid, pay_status, paid_specified)
    customer_svc.link_customer_finance(db, order.order_no, fin.id)


def _upsert_stock_out(db: Session, order: WorkOrder, cards: dict) -> None:
    if not (order.mac or order.imei or order.iccid or order.backup_iccid):
        return
    out = db.query(StockOut).filter(StockOut.order_no == order.order_no).first()
    is_new = out is None
    if is_new:
        out = StockOut(out_no=_gen_out_no(db), order_no=order.order_no)
        db.add(out)
    out.out_date = order.install_date
    out.store_name = order.store_name
    out.customer_name = order.customer_name
    out.model = order.device_model
    out.mac = order.mac
    out.imei = order.imei
    out.iccid = order.iccid
    out.iccid2 = order.backup_iccid
    out.operator = order.operator
    out.receiver = order.installer
    if cards["telecom"]:
        out.telecom_no = cards["telecom"]
    if cards["mobile"]:
        out.mobile_no = cards["mobile"]
    if cards["old"]:
        out.replaced_card_no = cards["old"]
    out.remark = out.remark or "关联导入"
    db.flush()
    if is_new:
        _apply_out_deduction(db, out)


def _upsert_stock_in(db: Session, order: WorkOrder, cards: dict) -> None:
    """历史设备/卡补登入库台账，库存记 0（已随工单出库）。"""
    if order.mac or order.imei:
        conds = [StockIn.mac == order.mac] if order.mac else [StockIn.imei == order.imei]
        if not db.query(StockIn).filter(*conds).first():
            db.add(StockIn(
                in_no=_gen_in_no(db), in_date=order.install_date, supplier=order.device_supplier,
                model=order.device_model, mac=order.mac, imei=order.imei,
                store_name=order.store_name, order_no=order.order_no,
                qty=1, stock_qty=0, receiver=order.installer, remark="关联导入补登",
            ))
            db.flush()
    for operator, iccid in (("中国电信", cards["telecom"]), ("中国移动", cards["mobile"])):
        if not iccid or db.query(SimStockIn).filter(SimStockIn.iccid == iccid).first():
            continue
        db.add(SimStockIn(
            in_no=_gen_in_no(db), in_date=order.install_date, supplier=order.sim_supplier,
            operator=operator, iccid=iccid, qty=1, stock_qty=0,
            receiver=order.installer, remark="关联导入补登",
        ))
        db.flush()


def _upsert_contract(db: Session, order: WorkOrder, raw: dict, period: str) -> None:
    dates = _DATE_RE.findall(period or "")
    start = end = ""
    if len(dates) >= 2:
        start, end = (f"{y}-{int(mo):02d}-{int(d):02d}" for y, mo, d in dates[:2])
    row = db.query(Contract).filter(Contract.order_no == order.order_no).first()
    if not row:
        row = Contract(contract_no=_gen_contract_no(db), order_no=order.order_no, city_code="SH")
        db.add(row)
        db.flush()
    row.customer_name = order.customer_name
    row.store_name = order.store_name
    row.sales_name = order.sales_name
    row.signer_name = order.contact or row.signer_name or ""
    row.signer_phone = order.contact_phone or row.signer_phone or ""
    row.package = order.card_package or row.package or ""
    amount = _to_amount(order.price or "")
    if amount:
        row.amount = amount
    if start and end:
        row.start_date, row.end_date = start, end
    base = _norm_contract_status(_s(raw, "contractStatus")) or row.status or "正常"
    row.status = resolve_contract_status(row.end_date, base, keep_pending=False)
    db.flush()


def _upsert_customer(db: Session, order: WorkOrder) -> Customer:
    """关联导入按工单号一对一维护客户，不按公司名/手机号合并。"""
    customer = db.query(Customer).filter(Customer.order_no == order.order_no).first()
    if not customer:
        customer = db.query(Customer).filter(
            Customer.order_no == "",
            Customer.sales_name == order.sales_name,
            Customer.customer_name == order.customer_name,
            Customer.store_name == order.store_name,
        ).first()
        if customer:
            customer.order_no = order.order_no
    if not customer:
        customer = Customer(order_no=order.order_no, contact_status="正常", source="关联导入", claim_time=customer_svc._now_str())
        db.add(customer)
    customer.sales_name = order.sales_name
    customer.store_name = order.store_name
    customer.customer_name = order.customer_name
    customer.contact = order.contact
    customer.phone = order.contact_phone
    for field in (
        "install_date", "device_supplier", "device_model", "mac", "imei", "sim_supplier", "operator",
        "iccid", "backup_iccid", "price", "device_cost", "card_cost", "card_package", "card_expire_date",
    ):
        setattr(customer, field, getattr(order, field) or getattr(customer, field) or "")
    db.flush()
    order.customer_id = customer.id
    return customer


def _upsert_contact(db: Session, order: WorkOrder) -> None:
    if not order.contact:
        return
    q = db.query(Contact).filter(Contact.customer_name == order.customer_name)
    row = q.filter(Contact.name == order.contact).first()
    if not row:
        row = Contact(
            customer_name=order.customer_name, name=order.contact,
            is_primary=not q.filter(Contact.is_primary.is_(True)).first(),
        )
        db.add(row)
    row.store_name = order.store_name
    row.phone = order.contact_phone or row.phone
    db.flush()


def _resolve_import_sales(sales: str, sales_names: set[str]) -> str:
    name = (sales or "").strip()
    if name and name in sales_names:
        return name
    return DEFAULT_IMPORT_SALES


def _import_row(db: Session, raw: dict, sales_names: set[str], operator: str) -> bool:
    sales = _resolve_import_sales(_s(raw, "salesName"), sales_names)
    store_raw = _s(raw, "storeName")
    if not store_raw:
        raise BizError("店名为空")
    _check_lengths(raw)

    company = _s(raw, "companyName")
    customer_name, store_name = _resolve_import_names(store_raw, company)
    legacy_shop, legacy_mall = _split_paren(store_raw)
    supplier = _s(raw, "deviceSupplier")
    if supplier:
        model = _s(raw, "device")
    else:
        model, supplier = _split_paren(_s(raw, "device"))
    contact, phone = _s(raw, "contact"), _s(raw, "phone")
    install_date = _norm_date(_s(raw, "installDate"))
    price = _s(raw, "price")
    period = _norm_period(_s(raw, "contractPeriod"))
    mac, imei = _s(raw, "mac"), _s(raw, "imei")
    cards = {
        "telecom": _card_no(_s(raw, "telecomNo")),
        "mobile": _card_no(_s(raw, "mobileNo")),
        "old": _card_no(_s(raw, "oldCardNo")),
    }
    for label, value in (("电信卡号", cards["telecom"]), ("移动卡号", cards["mobile"]), ("旧卡号", cards["old"]), ("IMEI", imei)):
        if re.fullmatch(r"\d+0{6,}", value):
            raise BizError(f"{label}「{value}」疑似被 Excel 截断，请将该列设为文本格式后重新填写")
    sims = [c for c in (cards["telecom"], cards["mobile"]) if c]
    card_expire = _norm_card_expire(_s(raw, "cardExpireDate"), install_date)
    order_no = _s(raw, "orderNo")
    order = _find_order(db, order_no, mac, imei, sims, sales, customer_name, store_name)
    if (
        order is None
        and not order_no
        and not company
        and legacy_shop
        and legacy_mall
        and _PAREN_RE.match(store_raw)
    ):
        order = (
            db.query(WorkOrder)
            .filter(
                WorkOrder.sales_name == sales,
                WorkOrder.customer_name == legacy_shop,
                WorkOrder.store_name == legacy_mall,
            )
            .first()
        )
    is_new = order is None
    if is_new:
        if not order_no:
            day = datetime.now().strftime("%Y%m%d")
            next_id = (db.query(WorkOrder.id).order_by(WorkOrder.id.desc()).limit(1).scalar() or 0) + 1
            order_no = f"GD-{day}-{next_id:03d}"
        order = WorkOrder(order_no=order_no, flow_logs=[], install_photos=[])
        db.add(order)

    order.sales_name = sales
    order.store_name = store_name
    order.customer_name = customer_name
    order.contact = contact or order.contact or ""
    order.contact_phone = phone or order.contact_phone or ""
    order.install_date = install_date or order.install_date or ""
    order.status = "已安装"
    order.installer = _s(raw, "installer") or order.installer or ""
    order.device_model = model or order.device_model or ""
    order.device_supplier = supplier or order.device_supplier or ""
    order.mac = mac or order.mac or ""
    order.imei = imei or order.imei or ""
    order.sim_supplier = _s(raw, "simSupplier") or order.sim_supplier or ""
    if cards["telecom"] and cards["mobile"]:
        order.iccid = cards["telecom"]
        order.operator = "中国电信"
        order.backup_iccid = cards["mobile"]
    elif cards["telecom"]:
        order.iccid = cards["telecom"]
        order.operator = "中国电信"
    elif cards["mobile"]:
        if order.iccid and order.iccid != cards["mobile"]:
            order.backup_iccid = cards["mobile"]
        else:
            order.iccid = cards["mobile"]
            order.operator = "中国移动"
    order.price = price or order.price or ""
    order.device_cost = _s(raw, "deviceCost") or order.device_cost or ""
    order.card_cost = _s(raw, "cardCost") or order.card_cost or ""
    order.card_package = _s(raw, "cardPackage") or order.card_package or ""
    order.card_expire_date = card_expire or order.card_expire_date or ""
    db.flush()
    _append_log(order, "关联导入", operator, "新建" if is_new else "覆盖更新")

    customer = _upsert_customer(db, order)
    customer.contract_period = period or customer.contract_period
    customer.invoice_type = _norm_invoice(_s(raw, "invoiceType")) or customer.invoice_type

    _upsert_finance(db, order, raw, period)
    _upsert_contract(db, order, raw, period)
    _upsert_contact(db, order)
    _upsert_stock_out(db, order, cards)
    _upsert_stock_in(db, order, cards)
    return is_new


def _import_error_message(exc: Exception) -> str:
    if isinstance(exc, BizError):
        return exc.message
    if isinstance(exc, DataError):
        return "数据格式或长度不符合要求"
    if isinstance(exc, IntegrityError):
        text = str(getattr(exc, "orig", "") or exc)
        matched = re.search(r"Key \(([^)]+)\)=\(([^)]*)\)", text)
        if matched:
            field, value = matched.group(1), matched.group(2)
            label = "工单号" if "order_no" in field else "数据"
            return f"{label}「{value}」已存在"
        return "与已有数据重复"
    return "导入失败"


def iter_import_integrated(db: Session, rows: list[dict], operator: str = ""):
    if not rows:
        yield {"type": "fatal", "message": "导入数据为空"}
        return
    sales_names = {name for (name,) in db.query(User.name).all()}
    total = len(rows)
    created = updated = failed = 0
    base = {"total": total, "done": 0, "created": 0, "updated": 0, "failed": 0}
    yield {"type": "start", **base}
    for seq, raw in enumerate(rows, start=1):
        excel_row = seq + 1
        try:
            with db.begin_nested():
                is_new = _import_row(db, raw, sales_names, operator)
            db.commit()
            if is_new:
                created += 1
            else:
                updated += 1
            yield {
                "type": "progress",
                "total": total,
                "done": seq,
                "created": created,
                "updated": updated,
                "failed": failed,
            }
        except Exception as exc:
            db.rollback()
            failed += 1
            yield {
                "type": "row_error",
                "message": f"第 {excel_row} 行：{_import_error_message(exc)}",
                "total": total,
                "done": seq,
                "created": created,
                "updated": updated,
                "failed": failed,
            }
    yield {
        "type": "done",
        "total": total,
        "done": total,
        "created": created,
        "updated": updated,
        "failed": failed,
    }


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def import_integrated(db: Session, rows: list[dict], operator: str = "") -> dict:
    errors: list[str] = []
    result = {"count": 0, "created": 0, "updated": 0, "errors": errors}
    for event in iter_import_integrated(db, rows, operator):
        if event["type"] == "fatal":
            raise BizError(event["message"])
        if event["type"] == "row_error":
            errors.append(event["message"])
        if event["type"] == "done":
            result = {
                "count": event["created"] + event["updated"],
                "created": event["created"],
                "updated": event["updated"],
                "errors": errors,
            }
    return result
