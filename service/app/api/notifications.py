from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.notify import AdminNotificationSendRequest, NotificationReadRequest
from app.services import notify_service

router = APIRouter(prefix="/notifications", tags=["消息通知"])


@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ok(notify_service.list_for_user(db, user.id))


@router.put("/read")
def mark_notifications_read(
    body: NotificationReadRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ok(notify_service.mark_read(db, user.id, body.id))


@router.get("/templates")
def list_notification_templates(
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:notify:view", "system:notify:send")),
):
    return ok(notify_service.list_templates())


@router.get("/admin/records")
def list_admin_notification_records(
    page: int = 1,
    size: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:notify:view", "system:notify:send")),
):
    return ok(notify_service.list_broadcasts(db, page=page, size=size))


@router.post("/admin/send")
def send_admin_notification(
    body: AdminNotificationSendRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:notify:send")),
):
    result = notify_service.admin_send(
        db,
        user.id,
        title=body.title,
        content=body.content,
        type=body.type,
        path=body.path,
        target_type=body.targetType,
        role_codes=body.roleCodes,
        user_ids=body.userIds,
        channels=body.channels,
    )
    log_action(db, user, "create", "系统", f"发送通知「{body.title}」给 {result['recipientCount']} 人", request=request)
    return ok(result)
