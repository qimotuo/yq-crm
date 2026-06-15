from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import trace_service as svc

router = APIRouter(tags=["全链路追溯"])


@router.get("/trace")
def get_trace(
    request: Request,
    type: str = Query("orderNo", alias="type"),
    value: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("trace:view", "customer:view", "workorder:view")),
):
    log_action(db, user, "query", "追溯", f"全链路查询 {type}={value}", request=request)
    return ok(svc.trace_query(db, type, value))
