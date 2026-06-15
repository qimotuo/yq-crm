from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.notify import ScheduleCreateRequest
from app.services import schedule_service

router = APIRouter(prefix="/schedules", tags=["日程管理"])


@router.get("")
def list_schedules(
    request: Request,
    date: str = Query("", alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("schedule:view")),
):
    log_action(db, user, "query", "日程", f"查询日程 date={date or '全部'}", request=request)
    return ok(schedule_service.list_schedules(db, user, date, perms))


@router.post("")
def create_schedule(
    body: ScheduleCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("schedule:create")),
):
    item = schedule_service.create_schedule(db, user, body.model_dump())
    log_action(
        db, user, "create", "日程",
        f"创建日程「{body.title}」{body.date} {body.time}",
        request=request,
    )
    return ok(item)


@router.put("/complete")
def complete_schedule(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("schedule:edit")),
):
    item = schedule_service.complete_schedule(db, user, body["id"], perms)
    log_action(db, user, "update", "日程", f"完成日程「{item['title']}」", request=request)
    return ok(item)
