import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.data_scope import is_all_data_scope, resolve_sales_filter
from app.core.exceptions import BizError
from app.services import customer_service as customer_svc
from app.db.models import Customer, FollowUp, User

_FOLLOW_TYPES = {"电话", "微信", "上门"}
_FOLLOW_STATUSES = {"已完成", "待完成"}
_NEXT_PLAN_DATE_RE = re.compile(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})")
_NEXT_PLAN_TIME_RE = re.compile(r"(\d{1,2}:\d{2})")


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _to_dict(item: FollowUp) -> dict:
    return {
        "id": item.id,
        "customerId": item.customer_id,
        "customerName": item.customer_name,
        "salesName": item.sales_name,
        "type": item.type,
        "content": item.content,
        "nextPlan": item.next_plan,
        "status": item.status,
        "createTime": item.create_time,
    }


def list_follow_ups(
    db: Session,
    user: User,
    customer_id: int = 0,
    sales_name: str = "",
    follow_type: str = "",
    keyword: str = "",
    status: str = "",
    perms: dict | None = None,
) -> dict:
    perms = perms or {}
    q = db.query(FollowUp)
    sales = resolve_sales_filter(perms, user, sales_name)
    if sales:
        q = q.filter(FollowUp.sales_name.contains(sales))
    elif not is_all_data_scope(perms):
        q = q.filter(FollowUp.sales_name == user.name)
    if customer_id:
        q = q.filter(FollowUp.customer_id == customer_id)
    if follow_type:
        q = q.filter(FollowUp.type == follow_type)
    if keyword:
        q = q.filter(FollowUp.content.contains(keyword))
    if status:
        q = q.filter(FollowUp.status == status)
    rows = q.order_by(FollowUp.create_time.desc(), FollowUp.id.desc()).all()
    return {"list": [_to_dict(r) for r in rows], "total": len(rows)}


def _parse_next_plan(text: str) -> tuple[str, str] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    m = _NEXT_PLAN_DATE_RE.search(raw)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    date = f"{y:04d}-{mo:02d}-{d:02d}"
    tm = _NEXT_PLAN_TIME_RE.search(raw)
    time = tm.group(1) if tm else "10:00"
    if len(time) == 4:
        time = f"0{time}"
    return date, time


def _schedule_type_from_follow(follow_type: str) -> str:
    if follow_type == "上门":
        return "上门"
    if follow_type == "安装":
        return "安装"
    return "电话"


def create_follow_up(db: Session, user: User, data: dict, *, auto_schedule: bool = True) -> dict:
    content = (data.get("content") or "").strip()
    if not content:
        raise BizError("跟进内容不能为空")

    follow_type = data.get("type") or "电话"
    if follow_type not in _FOLLOW_TYPES:
        raise BizError("跟进方式无效")

    status = data.get("status") or ("待完成" if data.get("nextPlan") else "已完成")
    if status not in _FOLLOW_STATUSES:
        raise BizError("状态无效")

    now = _now_str()
    item = FollowUp(
        user_id=user.id,
        customer_id=data.get("customerId") or 0,
        customer_name=data.get("customerName") or "",
        sales_name=data.get("salesName") or user.name,
        type=follow_type,
        content=content,
        next_plan=data.get("nextPlan") or "",
        status=status,
        create_time=now,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    cid = data.get("customerId")
    if cid:
        customer_svc.update_customer_follow_meta(db, cid, now)

    if auto_schedule:
        parsed = _parse_next_plan(data.get("nextPlan", ""))
        if parsed:
            from app.services import schedule_service as schedule_svc

            date, time = parsed
            schedule_svc.create_schedule(
                db,
                user,
                {
                    "title": f"跟进·{data.get('customerName') or '客户'}",
                    "customerName": data.get("customerName") or "",
                    "date": date,
                    "time": time,
                    "type": _schedule_type_from_follow(follow_type),
                },
            )
    return _to_dict(item)


def create_follow_up_from_schedule(db: Session, user: User, schedule) -> dict:
    customer_id = 0
    if schedule.customer_name:
        row = (
            db.query(Customer)
            .filter(Customer.customer_name == schedule.customer_name)
            .order_by(Customer.id.desc())
            .first()
        )
        if row:
            customer_id = row.id
    return create_follow_up(
        db,
        user,
        {
            "customerId": customer_id,
            "customerName": schedule.customer_name,
            "type": schedule.type if schedule.type in _FOLLOW_TYPES else "电话",
            "content": f"完成日程「{schedule.title}」",
            "status": "已完成",
        },
        auto_schedule=False,
    )
