from datetime import date

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.data_scope import get_data_scope, list_dept_member_ids, resolve_sales_names
from app.db.models import (
    Contact,
    Contract,
    Customer,
    Finance,
    FollowUp,
    PublicPoolCustomer,
    Schedule,
    SimStockIn,
    StockIn,
    WorkOrder,
)
from app.services.settings_service import get_stock_low_threshold

TREND_MONTHS = 5


def _order_month_from_no(order_no: str) -> str | None:
    parts = order_no.split("-")
    if len(parts) >= 2 and len(parts[1]) == 8:
        return parts[1][:6]
    return None


def _order_trend_month(order: WorkOrder) -> str | None:
    install = order.install_date or ""
    order_no = order.order_no or ""
    if len(install) >= 7:
        return install[:7].replace("-", "")
    return _order_month_from_no(order_no)


def _last_n_months(n: int = TREND_MONTHS) -> list[str]:
    result: list[str] = []
    y, m = date.today().year, date.today().month
    for _ in range(n):
        result.append(f"{y:04d}{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(result))


def _collect_trend_months(work_orders: list, finance_list: list, n: int = TREND_MONTHS) -> list[str]:
    keys: set[str] = {date.today().strftime("%Y%m")}
    for order in work_orders:
        ym = _order_trend_month(order)
        if ym:
            keys.add(ym)
    for item in finance_list:
        ym = (item.get("billMonth") or "").replace("-", "")
        if ym:
            keys.add(ym)
    sorted_keys = sorted(keys)
    if len(sorted_keys) >= n:
        return sorted_keys[-n:]
    for ym in _last_n_months(n):
        keys.add(ym)
    return sorted(keys)[-n:]


def _format_month_label(ym: str) -> str:
    return f"{int(ym[4:])}月"


def _low_stock_count(db: Session) -> int:
    thr = get_stock_low_threshold(db)
    return (
        db.query(StockIn).filter(StockIn.stock_qty <= thr).count()
        + db.query(SimStockIn).filter(SimStockIn.stock_qty <= thr).count()
    )


def _count_today_schedules(db: Session, today: str, user_ids: set[int] | None = None) -> int:
    base = db.query(Schedule)
    if user_ids is not None:
        base = base.filter(Schedule.user_id.in_(user_ids))
    count = base.filter(Schedule.date == today, Schedule.status == "待执行").count()
    if count > 0:
        return count
    stale_q = db.query(Schedule)
    if user_ids is not None:
        stale_q = stale_q.filter(Schedule.user_id.in_(user_ids))
    stale = (
        stale_q.filter(Schedule.status == "待执行", Schedule.date < today)
        .order_by(Schedule.date.desc())
        .limit(3)
        .all()
    )
    if not stale:
        return 0
    for row in stale:
        row.date = today
    db.commit()
    return len(stale)


def dashboard_stats(db: Session, user=None, perms=None) -> dict:
    today = date.today().isoformat()
    current_month = today[:7]

    # 数据权限：names=None 表示不限（ALL/超管），否则按部门/本人姓名集合过滤
    names: set[str] | None = None
    user_ids: set[int] | None = None
    if user is not None and perms is not None:
        names_list = resolve_sales_names(db, perms, user)
        if names_list is not None:
            names = set(names_list)
            user_ids = set(list_dept_member_ids(db, user))

    scope = get_data_scope(perms) if perms is not None else "ALL"
    owner_scope = names is not None and scope != "ASSIGNED"
    finance_q = db.query(Finance)
    contract_q = db.query(Contract)
    if names is not None and not owner_scope:
        finance_q = finance_q.filter(Finance.sales_name.in_(names))
        contract_q = contract_q.filter(Contract.sales_name.in_(names))
    finance_rows = finance_q.all()
    contract_rows = contract_q.all()

    def _order_q():
        q = db.query(WorkOrder)
        if names is not None and not owner_scope:
            q = q.filter(or_(WorkOrder.sales_name.in_(names), WorkOrder.installer.in_(names)))
        return q

    order_rows = _order_q().all()
    customer_q = db.query(Customer).filter(Customer.owner_status != "pending")
    follow_q = db.query(FollowUp)
    if names is not None and not owner_scope:
        customer_q = customer_q.filter(Customer.sales_name.in_(names))
        follow_q = follow_q.filter(FollowUp.sales_name.in_(names))
    elif names is not None:
        customer_q = customer_q.filter(Customer.sales_name.in_(names))
    follow_rows = follow_q.all()
    if owner_scope:
        from app.services.customer_owner import OwnerIndex

        index = OwnerIndex.load(db)
        finance_rows = [
            row for row in finance_rows
            if OwnerIndex.visible(index.find(order_no=row.order_no, store=row.store_name, customer_name=row.customer_name), row.sales_name, names)
        ]
        contract_rows = [
            row for row in contract_rows
            if OwnerIndex.visible(index.find(order_no=row.order_no, store=row.store_name, customer_name=row.customer_name), row.sales_name, names)
        ]
        order_rows = [
            row for row in order_rows
            if OwnerIndex.visible(index.find(row.customer_id, row.order_no, row.store_name, row.customer_name), row.sales_name, names)
        ]
        follow_rows = [
            row for row in follow_rows
            if OwnerIndex.visible(index.by_id.get(row.customer_id) if row.customer_id else None, row.sales_name, names)
        ]
    finance_list = [
        {
            "salesName": f.sales_name,
            "billMonth": f.bill_month,
            "totalAmount": f.total_amount,
            "unpaidAmount": f.unpaid_amount,
            "paymentStatus": f.payment_status,
        }
        for f in finance_rows
    ]
    contract_count = len(contract_rows)
    customer_count = customer_q.count()
    follow_up_count = len(follow_rows)
    today_schedules = _count_today_schedules(db, today, user_ids)
    pending_dispatch = sum(1 for o in order_rows if o.status == "待派工")
    installing = sum(1 for o in order_rows if o.status in ("已派工", "安装中"))
    completed = sum(1 for o in order_rows if o.status == "已安装")
    total_orders = len(order_rows)

    monthly_revenue = sum(f["totalAmount"] for f in finance_list if f.get("billMonth") == current_month)
    unpaid_amount = sum(f.get("unpaidAmount", 0) for f in finance_list)
    overdue_count = sum(1 for f in finance_list if f.get("paymentStatus") == "已逾期")

    month_keys = _collect_trend_months(order_rows, finance_list)
    monthly_trends = []
    for ym in month_keys:
        bill_prefix = f"{ym[:4]}-{ym[4:]}"
        month_orders = sum(1 for o in order_rows if _order_trend_month(o) == ym)
        monthly_trends.append({
            "month": _format_month_label(ym),
            "orders": month_orders,
            "revenue": sum(f["totalAmount"] for f in finance_list if f.get("billMonth") == bill_prefix),
        })

    return {
        "totalOrders": total_orders,
        "pendingDispatch": pending_dispatch,
        "installing": installing,
        "completed": completed,
        "totalCustomers": customer_count,
        "monthlyRevenue": monthly_revenue,
        "unpaidAmount": unpaid_amount,
        "overdueCount": overdue_count,
        "publicPoolCount": db.query(PublicPoolCustomer).filter(PublicPoolCustomer.status == "在公海").count(),
        "lowStockCount": _low_stock_count(db),
        "todaySchedules": today_schedules,
        "contractCount": contract_count,
        "followUpCount": follow_up_count,
        "contactCount": db.query(Contact).count(),
        "monthlyTrends": monthly_trends,
    }
