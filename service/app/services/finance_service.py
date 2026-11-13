from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import Customer, Finance, WorkOrder
from app.services import customer_service as customer_svc
from app.utils.contract_status import resolve_contract_status
from app.utils.finance_calc import calc_payment_status


def finance_to_dict(row: Finance) -> dict:
    return {
        "id": row.id,
        "storeName": row.store_name,
        "customerName": row.customer_name,
        "orderNo": row.order_no,
        "package": row.package,
        "billMonth": row.bill_month,
        "contractPeriod": row.contract_period,
        "contractStatus": resolve_contract_status(row.contract_period, row.contract_status),
        "totalAmount": row.total_amount,
        "paidAmount": row.paid_amount,
        "unpaidAmount": row.unpaid_amount,
        "paymentStatus": row.payment_status,
        "paymentProgress": row.payment_progress,
        "invoiceStatus": row.invoice_status,
        "salesName": row.sales_name,
        "paymentPlanDate": row.payment_plan_date,
        "lastPaymentTime": row.last_payment_time,
        "paymentRecords": list(row.payment_records or []),
    }


def _build_finance_row(body: dict) -> Finance:
    total = float(body.get("totalAmount") or 0)
    paid = float(body.get("paidAmount") or 0)
    plan_date = body.get("paymentPlanDate") or ""
    calc = calc_payment_status(total, paid, plan_date)
    bill_month = body.get("billMonth") or date.today().strftime("%Y-%m")
    return Finance(
        store_name=body.get("storeName", ""),
        customer_name=body.get("customerName", ""),
        order_no=body.get("orderNo", ""),
        package=body.get("package", ""),
        bill_month=bill_month,
        contract_period=body.get("contractPeriod", ""),
        contract_status=body.get("contractStatus", "正常"),
        total_amount=total,
        paid_amount=paid,
        unpaid_amount=calc["unpaidAmount"],
        payment_status=calc["paymentStatus"],
        payment_progress=calc["paymentProgress"],
        invoice_status=body.get("invoiceStatus", "待开票"),
        sales_name=body.get("salesName", ""),
        payment_plan_date=plan_date,
        last_payment_time=body.get("lastPaymentTime", "") if paid > 0 else "",
        payment_records=list(body.get("paymentRecords") or []),
    )


def _asset_health(contact_status: str, mac: str, order_no: str) -> str:
    if contact_status == "中断合作" or (order_no and not mac):
        return "离线预警"
    return "正常"


def _attach_order_fields(db: Session, items: list[dict]) -> None:
    """联系人、手机号、售价、联系状态、资产健康按工单号从客户和工单带出。"""
    customers = {c.order_no: c for c in db.query(Customer).all() if c.order_no}
    orders = {o.order_no: o for o in db.query(WorkOrder).all() if o.order_no}
    for item in items:
        order = orders.get(item.get("orderNo") or "")
        customer = customers.get(item.get("orderNo") or "")
        item["contact"] = (order.contact if order and order.contact else "") or (customer.contact if customer else "")
        item["phone"] = (order.contact_phone if order and order.contact_phone else "") or (customer.phone if customer else "")
        item["price"] = (order.price if order and order.price else "") or (customer.price if customer else "")
        contact_status = (customer.contact_status if customer else "") or "正常"
        mac = (order.mac if order and order.mac else "") or (customer.mac if customer else "")
        item["contactStatus"] = contact_status
        item["assetHealth"] = _asset_health(contact_status, mac, item.get("orderNo") or "")


def _match_keyword(item: dict, keyword: str) -> bool:
    kw = keyword.strip().lower()
    if not kw:
        return True
    fields = ("customerName", "storeName", "orderNo", "contact", "phone", "package")
    return any(kw in str(item.get(key) or "").lower() for key in fields)


def list_finance(
    db: Session,
    payment_status: str = "",
    order_no: str = "",
    finance_id: int | None = None,
    keyword: str = "",
    invoice_status: str = "",
    contract_status: str = "",
    sales_name: str = "",
    bill_month: str = "",
    sales_names: list[str] | None = None,
    contact_status: str = "",
    asset_health: str = "",
) -> dict:
    q = db.query(Finance)
    scoped = sales_names is not None
    if scoped:
        if not sales_names:
            return {"list": [], "total": 0}
    elif sales_name:
        q = q.filter(Finance.sales_name.contains(sales_name.strip()))
    if finance_id is not None:
        q = q.filter(Finance.id == finance_id)
    if order_no:
        q = q.filter(Finance.order_no.contains(order_no.strip()))
    if payment_status:
        q = q.filter(Finance.payment_status == payment_status)
    if invoice_status:
        q = q.filter(Finance.invoice_status == invoice_status)
    if bill_month:
        q = q.filter(Finance.bill_month.contains(bill_month.strip()))
    rows = q.order_by(Finance.id).all()
    if scoped:
        from app.services.customer_owner import OwnerIndex

        index = OwnerIndex.load(db)
        allowed = set(sales_names or [])
        rows = [
            row for row in rows
            if OwnerIndex.visible(
                index.find(order_no=row.order_no, store=row.store_name, customer_name=row.customer_name),
                row.sales_name,
                allowed,
            )
        ]
    items = [finance_to_dict(r) for r in rows]
    _attach_order_fields(db, items)
    if keyword:
        items = [i for i in items if _match_keyword(i, keyword)]
    if contract_status:
        items = [i for i in items if i.get("contractStatus") == contract_status]
    if contact_status:
        items = [i for i in items if i.get("contactStatus") == contact_status]
    if asset_health:
        items = [i for i in items if i.get("assetHealth") == asset_health]
    return {"list": items, "total": len(items)}


def create_finance(db: Session, body: dict) -> dict:
    order_no = body.get("orderNo", "")
    if order_no and db.query(Finance).filter(Finance.order_no == order_no).first():
        raise BizError(f"工单 {order_no} 已存在财务账单")
    row = _build_finance_row(body)
    db.add(row)
    db.commit()
    db.refresh(row)
    customer_svc.link_customer_finance(db, order_no, row.id)
    return finance_to_dict(row)


def update_finance(db: Session, body: dict) -> dict:
    row = db.query(Finance).filter(Finance.id == body["id"]).first()
    if not row:
        raise BizError("财务账单不存在")
    order_no = (body.get("orderNo") or "").strip()
    if order_no:
        other = db.query(Finance).filter(Finance.order_no == order_no, Finance.id != row.id).first()
        if other:
            raise BizError(f"工单 {order_no} 已存在财务账单")
    total = float(body.get("totalAmount") or 0)
    old_paid = float(row.paid_amount or 0)
    paid = float(body.get("paidAmount") or 0)
    plan_date = body.get("paymentPlanDate") or ""
    calc = calc_payment_status(total, paid, plan_date)
    row.store_name = body.get("storeName", "")
    row.customer_name = body.get("customerName", "")
    row.order_no = order_no
    row.package = body.get("package", "")
    row.bill_month = body.get("billMonth") or row.bill_month
    row.contract_period = body.get("contractPeriod", "")
    row.total_amount = total
    row.paid_amount = paid
    row.unpaid_amount = calc["unpaidAmount"]
    row.payment_status = calc["paymentStatus"]
    row.payment_progress = calc["paymentProgress"]
    row.invoice_status = body.get("invoiceStatus") or row.invoice_status
    row.sales_name = body.get("salesName", "")
    row.payment_plan_date = plan_date
    delta = round(paid - old_paid, 2)
    if delta != 0:
        records = list(row.payment_records or [])
        records.append({
            "id": len(records) + 1,
            "amount": delta,
            "time": date.today().isoformat(),
            "voucher": "",
            "verified": False,
        })
        row.payment_records = records
        if paid > 0:
            row.last_payment_time = date.today().isoformat()
    db.commit()
    db.refresh(row)
    customer_svc.sync_finance_customer(db, row.id, order_no)
    if delta != 0 and order_no:
        customer_svc.update_customer_payment(db, order_no, row.last_payment_time or "", paid)
    db.commit()
    return finance_to_dict(row)


def import_finance(db: Session, rows: list[dict]) -> dict:
    new_rows = []
    for raw in rows:
        order_no = raw.get("orderNo", "")
        if order_no and db.query(Finance).filter(Finance.order_no == order_no).first():
            continue
        row = _build_finance_row(raw)
        db.add(row)
        db.flush()
        customer_svc.link_customer_finance(db, order_no, row.id)
        new_rows.append(row)
    db.commit()
    items = [finance_to_dict(r) for r in new_rows]
    return {"count": len(items), "list": items}


def get_payment_records(db: Session, finance_id: int) -> dict:
    row = db.query(Finance).filter(Finance.id == finance_id).first()
    if not row:
        raise BizError("财务账单不存在")
    records = list(row.payment_records or [])
    return {"list": records, "total": len(records)}


def record_payment(db: Session, body: dict) -> dict:
    row = db.query(Finance).filter(Finance.id == body["id"]).first()
    if not row:
        raise BizError("财务账单不存在")
    paid_amount = float(body.get("paidAmount") or 0)
    records = list(row.payment_records or [])
    if body.get("voucher") or body.get("verified"):
        delta = paid_amount - (row.paid_amount or 0)
        records.append({
            "id": len(records) + 1,
            "amount": delta if delta > 0 else paid_amount,
            "time": date.today().isoformat(),
            "voucher": body.get("voucher") or "",
            "verified": bool(body.get("verified")),
        })
    calc = calc_payment_status(row.total_amount, paid_amount, row.payment_plan_date or "")
    row.paid_amount = paid_amount
    row.unpaid_amount = calc["unpaidAmount"]
    row.payment_status = calc["paymentStatus"]
    row.payment_progress = calc["paymentProgress"]
    row.payment_records = records
    if paid_amount > 0:
        row.last_payment_time = date.today().isoformat()
    db.commit()
    db.refresh(row)
    customer_svc.update_customer_payment(db, row.order_no, row.last_payment_time, paid_amount)
    return finance_to_dict(row)


def send_bill(db: Session, body: dict, operator_name: str = "") -> dict:
    """发送对账单：落发送记录 + 站内信提醒经办销售（邮件通道接入前先记录）。"""
    row = db.query(Finance).filter(Finance.id == body.get("id")).first()
    if not row:
        raise BizError("财务账单不存在")
    sent_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    records = list(row.payment_records or [])
    records.append({
        "id": len(records) + 1,
        "type": "send_bill",
        "amount": 0,
        "time": sent_at,
        "voucher": "",
        "verified": True,
        "remark": f"对账单已发送至 {body.get('email') or '客户'}（操作人：{operator_name or '-'}）",
    })
    row.payment_records = records
    db.commit()

    from app.db.models import Notification, User

    sales = (
        db.query(User)
        .filter(User.name == row.sales_name, User.enabled.is_(True))
        .first()
    )
    if sales:
        db.add(Notification(
            user_id=sales.id,
            type="财务",
            title=f"对账单已发送：{row.customer_name}",
            content=f"账单 {row.order_no or row.id} 对账单已发送，未回款 {row.unpaid_amount} 元",
            path="/finance",
            source_type="finance",
            source_id=row.id,
        ))
        db.commit()
    return {
        "sent": True,
        "sentAt": sent_at,
        "email": body.get("email"),
        "customerName": body.get("customerName") or row.customer_name,
        "unpaidAmount": row.unpaid_amount,
    }
