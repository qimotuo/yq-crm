from sqlalchemy.orm import Session

from app.db.models import Schedule, User
from app.services import notify_service


def list_schedules(db: Session, user: User, date_filter: str = "") -> dict:
    q = db.query(Schedule)
    if user.role_code == "sales":
        q = q.filter(Schedule.user_id == user.id)
    elif user.role_code not in ("admin",):
        q = q.filter(Schedule.sales_name == user.name)
    if date_filter:
        q = q.filter(Schedule.date == date_filter)
    rows = q.order_by(Schedule.date.desc(), Schedule.time).all()
    return {"list": [_to_dict(r) for r in rows], "total": len(rows)}


def create_schedule(db: Session, user: User, data: dict) -> dict:
    item = Schedule(
        user_id=user.id,
        sales_name=user.name,
        title=data["title"],
        customer_name=data["customerName"],
        date=data["date"],
        time=data.get("time", "09:00"),
        type=data.get("type", "上门"),
        status="待执行",
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    notify_service.send_from_template(
        db,
        user_id=user.id,
        template_code="schedule_created",
        context={
            "date": item.date,
            "time": item.time,
            "title": item.title,
            "customer_name": item.customer_name,
        },
        source_type="schedule",
        source_id=item.id,
    )

    from datetime import date as date_cls

    if item.date == date_cls.today().isoformat():
        notify_service.send_from_template(
            db,
            user_id=user.id,
            template_code="schedule_reminder",
            context={
                "time": item.time,
                "title": item.title,
                "customer_name": item.customer_name,
            },
            source_type="schedule",
            source_id=item.id,
            dedupe=True,
        )
    return _to_dict(item)


def complete_schedule(db: Session, user: User, schedule_id: int) -> dict:
    q = db.query(Schedule).filter(Schedule.id == schedule_id)
    if user.role_code == "sales":
        q = q.filter(Schedule.user_id == user.id)
    item = q.first()
    if not item:
        from app.core.exceptions import BizError
        raise BizError("日程不存在")
    item.status = "已完成"
    db.commit()
    db.refresh(item)
    return _to_dict(item)


def _to_dict(s: Schedule) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "customerName": s.customer_name,
        "salesName": s.sales_name,
        "date": s.date,
        "time": s.time,
        "type": s.type,
        "status": s.status,
    }
