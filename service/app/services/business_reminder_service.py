"""业务自动提醒：付费、合同到期、库存不足 → 站内信（+ 预留阿里云通道）。"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Contract, Finance, SimStockIn, StockIn, User
from app.services import notify_service
from app.utils.contract_status import resolve_contract_status
from app.utils.finance_calc import calc_payment_status

logger = logging.getLogger(__name__)

STOCK_LOW_THRESHOLD_DEFAULT = 5


def _today() -> date:
    return date.today()


def _dedupe_day(prefix: str) -> str:
    return f"{prefix}:{_today().isoformat()}"


def _parse_date(raw: str) -> date | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _users_by_name(db: Session, name: str) -> list[User]:
    if not (name or "").strip():
        return []
    return (
        db.query(User)
        .filter(User.enabled.is_(True), User.name == name.strip())
        .all()
    )


def _notify_targets(
    db: Session,
    *,
    operation: str,
    sales_name: str = "",
    template_code: str,
    context: dict,
    source_type: str,
    source_id: int,
) -> int:
    seen: set[int] = set()
    count = 0
    targets: list[User] = []
    targets.extend(_users_by_name(db, sales_name))
    targets.extend(notify_service.users_with_operation(db, operation))
    for user in targets:
        if user.id in seen:
            continue
        seen.add(user.id)
        notify_service.send_from_template(
            db,
            user_id=user.id,
            template_code=template_code,
            context=context,
            source_type=source_type,
            source_id=source_id,
            dedupe=True,
        )
        count += 1
    return count


def scan_finance_reminders(db: Session) -> dict:
    """付费提醒（临近计划日）+ 逾期提醒。"""
    today = _today()
    due_days = max(0, int(settings.finance_due_days))
    due_count = 0
    overdue_count = 0

    dirty = False
    for item in db.query(Finance).all():
        if float(item.unpaid_amount or 0) <= 0:
            continue
        fid = item.id

        plan = _parse_date(item.payment_plan_date or "")
        # 以当前金额重算，超期状态同步落库
        calc = calc_payment_status(
            float(item.total_amount or 0),
            float(item.paid_amount or 0),
            item.payment_plan_date or "",
        )
        status = calc["paymentStatus"]
        unpaid = float(calc["unpaidAmount"])
        if status != item.payment_status:
            item.payment_status = status
            item.unpaid_amount = unpaid
            item.payment_progress = calc["paymentProgress"]
            dirty = True
        if unpaid <= 0:
            continue

        ctx = {
            "customer_name": item.customer_name or item.store_name or "-",
            "amount": f"{unpaid:.0f}" if unpaid == int(unpaid) else f"{unpaid:.2f}",
            "plan_date": item.payment_plan_date or "-",
            "order_no": item.order_no or "",
        }
        sales = item.sales_name or ""

        if status == "已逾期" or (plan and plan < today):
            overdue_count += _notify_targets(
                db,
                operation="finance:view",
                sales_name=sales,
                template_code="finance_overdue",
                context=ctx,
                source_type=_dedupe_day("finance_overdue"),
                source_id=fid,
            )
            continue

        if plan and today <= plan <= today + timedelta(days=due_days):
            due_count += _notify_targets(
                db,
                operation="finance:view",
                sales_name=sales,
                template_code="finance_payment_due",
                context=ctx,
                source_type=_dedupe_day("finance_payment_due"),
                source_id=fid,
            )

    if dirty:
        db.commit()
    return {"paymentDue": due_count, "overdue": overdue_count}


def scan_contract_expire(db: Session) -> dict:
    """合同即将到期提醒（默认 30 天内）。"""
    today = _today()
    window = max(1, int(settings.contract_expire_days))
    count = 0

    dirty = False
    for item in db.query(Contract).all():
        if item.status == "待生成":
            continue
        end = _parse_date(item.end_date or "")
        new_status = resolve_contract_status(item.end_date or "", item.status)
        if item.status != new_status:
            item.status = new_status
            dirty = True
        if not end:
            continue
        days_left = (end - today).days
        if days_left < 0 or days_left > window:
            continue

        ctx = {
            "customer_name": item.customer_name or item.store_name or "-",
            "days": days_left,
            "end_date": end.isoformat(),
            "contract_no": item.contract_no or "",
            "order_no": item.order_no or "",
        }
        count += _notify_targets(
            db,
            operation="contract:view",
            sales_name=item.sales_name or "",
            template_code="contract_expire",
            context=ctx,
            source_type=_dedupe_day("contract_expire"),
            source_id=item.id,
        )

    if dirty:
        db.commit()
    return {"count": count}


def scan_stock_low(db: Session) -> dict:
    """设备 / SIM 库存低于阈值提醒。"""
    from app.services.settings_service import get_stock_low_threshold

    threshold = get_stock_low_threshold(db)
    count = 0
    device_rows = db.query(StockIn).filter(StockIn.stock_qty <= threshold).all()
    sim_rows = db.query(SimStockIn).filter(SimStockIn.stock_qty <= threshold).all()
    for kind, rows in (("device", device_rows), ("sim", sim_rows)):
        for row in rows:
            qty = int(row.stock_qty or 0)
            if kind == "sim":
                item_name = f"SIM/{row.operator or '-'} {row.iccid or row.in_no or ''}".strip()
            else:
                model = row.model or row.supplier or "设备"
                item_name = f"{model} {row.mac or row.imei or row.in_no or ''}".strip()
            # source_id 区分设备/SIM：设备用原 id，SIM 用 100000+id 避免冲突
            source_id = row.id if kind == "device" else 100_000 + row.id
            ctx = {"item_name": item_name, "count": qty, "kind": kind}
            count += _notify_targets(
                db,
                operation="stock:view",
                sales_name="",
                template_code="stock_low",
                context=ctx,
                source_type=_dedupe_day(f"stock_low_{kind}"),
                source_id=source_id,
            )
    return {"count": count, "threshold": threshold}


def run_business_reminders(db: Session) -> dict:
    started = datetime.now().isoformat(timespec="seconds")
    from app.services.install_followup import generate_due_contracts

    finance = scan_finance_reminders(db)
    contracts = scan_contract_expire(db)
    generated = generate_due_contracts(db)
    stock = scan_stock_low(db)
    result = {
        "startedAt": started,
        "finance": finance,
        "contracts": contracts,
        "contractGenerated": generated,
        "stock": stock,
        "aliyunSmsEnabled": bool(settings.aliyun_sms_enabled),
    }
    logger.info(
        "业务提醒扫描完成 finance=%s contracts=%s stock=%s aliyun=%s",
        finance, contracts.get("count"), stock.get("count"), settings.aliyun_sms_enabled,
    )
    return result
