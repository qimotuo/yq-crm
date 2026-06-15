from app.core.data_scope import is_all_data_scope
from sqlalchemy.orm import Session

from app.db.models import Schedule, User
from app.services import notify_service


def _scoped_schedule_query(db: Session, user: User, perms: dict):
    q = db.query(Schedule)
    if is_all_data_scope(perms):
        return q
    return q.filter(Schedule.user_id == user.id)


def list_schedules(db: Session, user: User, date_filter: str = "", perms: dict | None = None) -> dict:
    perms = perms or {}
    q = _scoped_schedule_query(db, user, perms)
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


def complete_schedule(db: Session, user: User, schedule_id: int, perms: dict | None = None) -> dict:
    perms = perms or {}
    q = _scoped_schedule_query(db, user, perms).filter(Schedule.id == schedule_id)
    item = q.first()
    if not item:
        from app.core.exceptions import BizError
        raise BizError("日程不存在")
    item.status = "已完成"
    db.commit()
    db.refresh(item)
    result = _to_dict(item)
    from app.services import follow_up_service as follow_svc

    follow = follow_svc.create_follow_up_from_schedule(db, user, item)
    result["followUp"] = follow
    return result


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
