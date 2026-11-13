"""安装完成后补齐账单和待生成合同，满 8 天再编合同号。"""

from __future__ import annotations

import re
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.db.models import Contract, Finance, WorkOrder
from app.services.contract_service import activate_contract
from app.services.customer_service import link_customer_finance
from app.services.finance_service import _build_finance_row

# 安装当天算第 1 天，第 8 天自动生成正式合同号
_CONTRACT_DUE_OFFSET = timedelta(days=7)
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _amount(raw: str) -> float:
    text = (raw or "").replace(",", "").replace("＝", "=")
    if "=" in text:
        tail = text.rsplit("=", 1)[-1]
        matched = re.search(r"\d+(?:\.\d+)?", tail)
        if matched:
            return float(matched.group())
    matched = re.search(r"\d+(?:\.\d+)?", text)
    return float(matched.group()) if matched else 0.0


def _parse_date(raw: str) -> date | None:
    matched = _DATE.search(raw or "")
    if not matched:
        return None
    try:
        return date.fromisoformat(matched.group(0))
    except ValueError:
        return None


def _add_year(day: date) -> date:
    try:
        return day.replace(year=day.year + 1)
    except ValueError:
        return day.replace(year=day.year + 1, day=28)


def _period(install_date: str) -> tuple[str, str, str]:
    start = _parse_date(install_date) or date.today()
    end = _add_year(start) - timedelta(days=1)
    start_s, end_s = start.isoformat(), end.isoformat()
    return start_s, end_s, f"{start_s} 至 {end_s}"


def _base_date(order: WorkOrder | None, row: Contract) -> date | None:
    if order:
        parsed = _parse_date(order.install_date)
        if parsed:
            return parsed
        if order.created_at:
            return order.created_at.date()
    if row.created_at:
        return row.created_at.date()
    return None


def open_bill_and_contract(db: Session, order: WorkOrder) -> None:
    """安装登记落成「已安装」后，补一张未回款账单和一条待生成合同。"""
    if order.status != "已安装" or not order.order_no:
        return
    start, end, period = _period(order.install_date)
    amount = _amount(order.price)
    plan = (_parse_date(order.install_date) or date.today()) + _CONTRACT_DUE_OFFSET

    if not db.query(Finance).filter(Finance.order_no == order.order_no).first():
        fin = _build_finance_row({
            "storeName": order.store_name,
            "customerName": order.customer_name,
            "orderNo": order.order_no,
            "package": order.card_package or "",
            "billMonth": start[:7],
            "contractPeriod": period,
            "contractStatus": "待生成",
            "totalAmount": amount,
            "paidAmount": 0,
            "invoiceStatus": "待开票",
            "salesName": order.sales_name,
            "paymentPlanDate": plan.isoformat(),
        })
        db.add(fin)
        db.flush()
        link_customer_finance(db, order.order_no, fin.id)

    if not db.query(Contract).filter(Contract.order_no == order.order_no).first():
        db.add(Contract(
            contract_no=f"待{order.order_no}"[:32],
            order_no=order.order_no,
            customer_name=order.customer_name or "",
            signer_name=order.contact or "",
            signer_phone=(order.contact_phone or "")[:20],
            sign_date="",
            store_name=order.store_name or "",
            package=(order.card_package or "")[:64],
            amount=amount,
            start_date=start,
            end_date=end,
            status="待生成",
            city_code="SH",
            sales_name=order.sales_name or "",
        ))
        db.flush()


def generate_due_contracts(db: Session) -> dict:
    """待生成合同满 8 天则编号并改为正常。"""
    today = date.today()
    generated = 0
    rows = db.query(Contract).filter(Contract.status == "待生成").all()
    for row in rows:
        order = None
        if row.order_no:
            order = db.query(WorkOrder).filter(WorkOrder.order_no == row.order_no).first()
        base = _base_date(order, row)
        if not base or today < base + _CONTRACT_DUE_OFFSET:
            continue
        activate_contract(db, row)
        if order and order.install_date:
            row.sign_date = row.sign_date or (base + _CONTRACT_DUE_OFFSET).isoformat()
        generated += 1
    if generated:
        db.commit()
    return {"generated": generated}
