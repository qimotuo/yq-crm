from datetime import date, datetime

from app.core.exceptions import BizError
from app.data.store import store
from app.services import customer_service as customer_svc
from app.utils.finance_calc import calc_payment_status


def _next_finance_id() -> int:
    store.finance_seq += 1
    return store.finance_seq


def _link_customer_finance(db, order_no: str, finance_id: int) -> None:
    if db is not None:
        customer_svc.link_customer_finance(db, order_no, finance_id)
        return
    for i, c in enumerate(store.customers):
        if c.get("orderNo") == order_no:
            store.customers[i] = {**c, "financeId": finance_id}
            break


def _build_finance_record(body: dict, finance_id: int | None = None) -> dict:
    total = float(body.get("totalAmount") or 0)
    paid = float(body.get("paidAmount") or 0)
    plan_date = body.get("paymentPlanDate") or ""
    calc = calc_payment_status(total, paid, plan_date)
    bill_month = body.get("billMonth") or date.today().strftime("%Y-%m")
    return {
        "id": finance_id or _next_finance_id(),
        "storeName": body.get("storeName", ""),
        "customerName": body.get("customerName", ""),
        "orderNo": body.get("orderNo", ""),
        "package": body.get("package", ""),
        "billMonth": bill_month,
        "contractPeriod": body.get("contractPeriod", ""),
        "contractStatus": body.get("contractStatus", "正常"),
        "totalAmount": total,
        "paidAmount": paid,
        "unpaidAmount": calc["unpaidAmount"],
        "paymentStatus": calc["paymentStatus"],
        "paymentProgress": calc["paymentProgress"],
        "invoiceStatus": body.get("invoiceStatus", "待开票"),
        "salesName": body.get("salesName", ""),
        "paymentPlanDate": plan_date,
        "lastPaymentTime": body.get("lastPaymentTime", "") if paid > 0 else "",
        "paymentRecords": body.get("paymentRecords") or [],
    }


def list_finance(
    payment_status: str = "",
    order_no: str = "",
    finance_id: int | None = None,
) -> dict:
    items = list(store.finance)
    if finance_id is not None:
        items = [f for f in items if f.get("id") == finance_id]
    if order_no:
        items = [f for f in items if f.get("orderNo") == order_no]
    if payment_status:
        items = [f for f in items if f.get("paymentStatus") == payment_status]
    return {"list": items, "total": len(items)}


def create_finance(body: dict, db=None) -> dict:
    order_no = body.get("orderNo", "")
    if any(f.get("orderNo") == order_no for f in store.finance):
        raise BizError(f"工单 {order_no} 已存在财务账单")
    item = _build_finance_record(body)
    store.finance.append(item)
    _link_customer_finance(db, order_no, item["id"])
    return item


def import_finance(rows: list[dict], db=None) -> dict:
    new_items = []
    for row in rows:
        order_no = row.get("orderNo", "")
        if any(f.get("orderNo") == order_no for f in store.finance):
            continue
        item = _build_finance_record(row)
        store.finance.append(item)
        _link_customer_finance(db, order_no, item["id"])
        new_items.append(item)
    return {"count": len(new_items), "list": new_items}


def get_payment_records(finance_id: int) -> dict:
    item = next((f for f in store.finance if f.get("id") == finance_id), None)
    if not item:
        raise BizError("财务账单不存在")
    records = item.get("paymentRecords") or []
    return {"list": records, "total": len(records)}


def record_payment(body: dict, db=None) -> dict:
    finance_id = body["id"]
    paid_amount = float(body.get("paidAmount") or 0)
    idx = next((i for i, f in enumerate(store.finance) if f.get("id") == finance_id), None)
    if idx is None:
        raise BizError("财务账单不存在")
    item = store.finance[idx]
    records = list(item.get("paymentRecords") or [])
    if body.get("voucher") or body.get("verified"):
        delta = paid_amount - (item.get("paidAmount") or 0)
        records.append({
            "id": len(records) + 1,
            "amount": delta if delta > 0 else paid_amount,
            "time": date.today().isoformat(),
            "voucher": body.get("voucher") or "",
            "verified": bool(body.get("verified")),
        })
    calc = calc_payment_status(item["totalAmount"], paid_amount, item.get("paymentPlanDate", ""))
    updated = {
        **item,
        "paidAmount": paid_amount,
        "unpaidAmount": calc["unpaidAmount"],
        "paymentStatus": calc["paymentStatus"],
        "paymentProgress": calc["paymentProgress"],
        "paymentRecords": records,
        "lastPaymentTime": date.today().isoformat() if paid_amount > 0 else item.get("lastPaymentTime", ""),
    }
    store.finance[idx] = updated
    if db is not None:
        customer_svc.update_customer_payment(
            db,
            item.get("orderNo", ""),
            updated["lastPaymentTime"],
            paid_amount,
        )
    else:
        for i, c in enumerate(store.customers):
            if c.get("orderNo") == item.get("orderNo", ""):
                store.customers[i] = {
                    **c,
                    "lastPaymentTime": updated["lastPaymentTime"],
                    "lastPaymentAmount": paid_amount,
                }
                break
    return updated


def send_bill(body: dict) -> dict:
    finance_id = body.get("id")
    item = next((f for f in store.finance if f.get("id") == finance_id), None)
    if not item:
        raise BizError("财务账单不存在")
    return {
        "sent": True,
        "email": body.get("email"),
        "customerName": body.get("customerName") or item.get("customerName"),
        "unpaidAmount": item.get("unpaidAmount"),
    }
