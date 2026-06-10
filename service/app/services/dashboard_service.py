from datetime import date

from sqlalchemy.orm import Session

from app.data.store import store
from app.db.models import Schedule

LOW_STOCK_THRESHOLD = 5
TREND_MONTHS = 5


def _order_month(order_no: str) -> str | None:
    parts = order_no.split("-")
    if len(parts) >= 2 and len(parts[1]) == 8:
        return parts[1][:6]
    return None


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


def _format_month_label(ym: str) -> str:
    return f"{int(ym[4:])}月"


def _low_stock_count() -> int:
    items = getattr(store, "stock_in", []) + getattr(store, "sim_stock_in", [])
    return sum(1 for s in items if (s.get("stockQty") or 0) < LOW_STOCK_THRESHOLD)


def dashboard_stats(db: Session | None = None) -> dict:
    today = date.today().isoformat()
    current_month = today[:7]
    orders = store.work_orders
    finance_list = getattr(store, "finance", [])

    monthly_revenue = sum(f["totalAmount"] for f in finance_list if f.get("billMonth") == current_month)
    unpaid_amount = sum(f.get("unpaidAmount", 0) for f in finance_list)
    overdue_count = sum(1 for f in finance_list if f.get("paymentStatus") == "已逾期")

    today_schedules = 0
    if db is not None:
        today_schedules = (
            db.query(Schedule)
            .filter(Schedule.date == today, Schedule.status == "待执行")
            .count()
        )
    else:
        today_schedules = sum(
            1 for s in store.schedules if s.get("date") == today and s.get("status") == "待执行"
        )

    month_keys = _last_n_months()
    monthly_trends = []
    for ym in month_keys:
        bill_prefix = f"{ym[:4]}-{ym[4:]}"
        monthly_trends.append({
            "month": _format_month_label(ym),
            "orders": sum(1 for o in orders if _order_month(o.get("orderNo", "")) == ym),
            "revenue": sum(f["totalAmount"] for f in finance_list if f.get("billMonth") == bill_prefix),
        })

    return {
        "totalOrders": len(orders),
        "pendingDispatch": sum(1 for o in orders if o["status"] == "待派工"),
        "installing": sum(1 for o in orders if o["status"] in ("已派工", "安装中")),
        "completed": sum(1 for o in orders if o["status"] == "已安装"),
        "totalCustomers": len(store.customers),
        "monthlyRevenue": monthly_revenue,
        "unpaidAmount": unpaid_amount,
        "overdueCount": overdue_count,
        "publicPoolCount": sum(1 for c in store.public_pool if c["status"] == "在公海"),
        "lowStockCount": _low_stock_count(),
        "todaySchedules": today_schedules,
        "contractCount": len(store.contracts),
        "followUpCount": len(store.follow_ups),
        "contactCount": len(store.contacts),
        "monthlyTrends": monthly_trends,
    }
