from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.notify_templates import list_miniprogram_templates, list_site_templates, render_notify
from app.db.models import Notification, NotificationBroadcast, Role, Schedule, User


def _format_time(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = (now - dt).total_seconds()
    if diff < 60:
        return "刚刚"
    if diff < 3600:
        return f"{int(diff // 60)}分钟前"
    if diff < 86400:
        return f"{int(diff // 3600)}小时前"
    if diff < 172800:
        return "昨天"
    return dt.strftime("%Y-%m-%d %H:%M")


def _to_item(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "content": n.content,
        "path": n.path,
        "read": n.read,
        "time": _format_time(n.created_at),
        "templateCode": n.template_code,
    }


def send_from_template(
    db: Session,
    *,
    user_id: int,
    template_code: str,
    context: dict | None = None,
    source_type: str = "",
    source_id: int | None = None,
    dedupe: bool = False,
    path_override: str | None = None,
) -> Notification:
    if dedupe and source_type and source_id is not None:
        exists = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.template_code == template_code,
                Notification.source_type == source_type,
                Notification.source_id == source_id,
            )
            .first()
        )
        if exists:
            return exists

    rendered = render_notify(template_code, context)
    if path_override:
        rendered["path"] = path_override
    item = Notification(
        user_id=user_id,
        type=rendered["type"],
        title=rendered["title"],
        content=rendered["content"],
        path=rendered["path"],
        template_code=template_code,
        source_type=source_type,
        source_id=source_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # 扩展通道（阿里云短信等）：站内信成功后再推
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        from app.services.notify_channels import dispatch_extra_channels

        dispatch_extra_channels(
            user=user,
            template_code=template_code,
            title=rendered["title"],
            content=rendered["content"],
            context=context,
        )
    return item


def users_with_operation(db: Session, operation: str) -> list[User]:
    roles = db.query(Role).filter(Role.enabled.is_(True)).all()
    role_codes = {
        r.code for r in roles
        if "*" in (r.operations or []) or operation in (r.operations or [])
    }
    if not role_codes:
        return []
    return (
        db.query(User)
        .filter(User.enabled.is_(True), User.role_code.in_(role_codes))
        .all()
    )


def notify_users_with_operation(
    db: Session,
    operation: str,
    *,
    template_code: str,
    context: dict | None = None,
    source_type: str = "",
    source_id: int | None = None,
    path_override: str | None = None,
    exclude_user_ids: list[int] | None = None,
    dedupe: bool = True,
) -> int:
    excluded = set(exclude_user_ids or [])
    count = 0
    for user in users_with_operation(db, operation):
        if user.id in excluded:
            continue
        send_from_template(
            db,
            user_id=user.id,
            template_code=template_code,
            context=context,
            source_type=source_type,
            source_id=source_id,
            path_override=path_override,
            dedupe=dedupe,
        )
        count += 1
    return count


def list_for_user(db: Session, user_id: int) -> dict:
    ensure_schedule_reminders(db, user_id)
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread = sum(1 for r in rows if not r.read)
    return {"list": [_to_item(r) for r in rows], "unread": unread}


def mark_read(db: Session, user_id: int, notification_id: int | None = None) -> dict:
    q = db.query(Notification).filter(Notification.user_id == user_id, Notification.read.is_(False))
    if notification_id:
        q = q.filter(Notification.id == notification_id)
    q.update({Notification.read: True}, synchronize_session=False)
    db.commit()
    return {"success": True}


def _resolve_target_users(
    db: Session,
    target_type: str,
    role_codes: list[str],
    user_ids: list[int],
) -> list[User]:
    q = db.query(User).filter(User.enabled.is_(True))
    if target_type == "all":
        return q.all()
    if target_type == "roles":
        if not role_codes:
            return []
        return q.filter(User.role_code.in_(role_codes)).all()
    if target_type == "users":
        if not user_ids:
            return []
        return q.filter(User.id.in_(user_ids)).all()
    return []


def _build_target_label(db: Session, broadcast: NotificationBroadcast) -> tuple[str, str]:
    if broadcast.target_type == "all":
        return "全部用户", "all"
    if broadcast.target_type == "roles":
        from app.db.models import Role

        roles = db.query(Role).filter(Role.code.in_(broadcast.target_roles or [])).all()
        names = [r.name for r in roles] or broadcast.target_roles
        return "、".join(names), ",".join(broadcast.target_roles or [])
    users = db.query(User).filter(User.id.in_(broadcast.target_user_ids or [])).all()
    names = [u.name for u in users] or [str(i) for i in (broadcast.target_user_ids or [])]
    return "、".join(names), ",".join(str(i) for i in (broadcast.target_user_ids or []))


def list_templates() -> dict:
    return {"site": list_site_templates(), "miniprogram": list_miniprogram_templates()}


def list_broadcasts(db: Session, page: int = 1, size: int = 10) -> dict:
    q = db.query(NotificationBroadcast).order_by(NotificationBroadcast.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * size).limit(size).all()
    sender_ids = {r.sender_id for r in rows}
    senders = {u.id: u.name for u in db.query(User).filter(User.id.in_(sender_ids)).all()} if sender_ids else {}
    items = []
    for r in rows:
        target_label, target_detail = _build_target_label(db, r)
        items.append({
            "id": r.id,
            "title": r.title,
            "content": r.content,
            "type": r.type,
            "targetType": r.target_type,
            "targetLabel": target_label,
            "targetDetail": target_detail,
            "channels": r.channels or [],
            "recipientCount": r.recipient_count,
            "senderName": senders.get(r.sender_id, "未知"),
            "createdAt": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
        })
    return {"list": items, "total": total, "page": page, "size": size}


def admin_send(
    db: Session,
    sender_id: int,
    *,
    title: str,
    content: str,
    type: str = "系统",
    path: str = "",
    target_type: str,
    role_codes: list[str] | None = None,
    user_ids: list[int] | None = None,
    channels: list[str] | None = None,
) -> dict:
    channels = channels or ["site"]
    recipients = _resolve_target_users(db, target_type, role_codes or [], user_ids or [])
    if not recipients:
        raise BizError("未找到符合条件的接收用户")

    broadcast = NotificationBroadcast(
        sender_id=sender_id,
        title=title,
        content=content,
        type=type,
        path=path or "",
        target_type=target_type,
        target_roles=role_codes or [],
        target_user_ids=user_ids or [],
        channels=channels,
        recipient_count=0,
    )
    db.add(broadcast)
    db.flush()

    count = 0
    if "site" in channels:
        for user in recipients:
            item = Notification(
                user_id=user.id,
                type=type,
                title=title,
                content=content,
                path=path or "",
                template_code="system_notice",
                source_type="admin_broadcast",
                source_id=broadcast.id,
            )
            db.add(item)
            count += 1
    # miniprogram 渠道预留：接入微信订阅消息后在此推送

    broadcast.recipient_count = count
    db.commit()
    return {"broadcastId": broadcast.id, "recipientCount": count}


def ensure_schedule_reminders(db: Session, user_id: int) -> None:
    """为当日待执行日程生成提醒（同日程仅一条）。"""
    today = date.today().isoformat()
    schedules = (
        db.query(Schedule)
        .filter(Schedule.user_id == user_id, Schedule.date == today, Schedule.status == "待执行")
        .all()
    )
    for s in schedules:
        send_from_template(
            db,
            user_id=user_id,
            template_code="schedule_reminder",
            context={
                "time": s.time,
                "title": s.title,
                "customer_name": s.customer_name,
            },
            source_type="schedule",
            source_id=s.id,
            path_override="/pages/schedules/index",
            dedupe=True,
        )
