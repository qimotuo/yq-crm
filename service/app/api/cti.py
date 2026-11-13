from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import cti_service, settings_service

router = APIRouter(tags=["CTI与打印模板"])


@router.get("/cti/config")
def get_cti_config(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("my-customer:call", "contact:call", "customer:call", "system:cti:config")),
):
    return ok(settings_service.get_cti_config(db))


@router.put("/cti/config")
def update_cti_config(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:cti:config")),
):
    data = settings_service.update_cti_config(db, body)
    log_action(db, user, "update", "CTI", f"更新 CTI 配置 mode={data.get('mode')}", request=request)
    return ok(data)


@router.post("/calls/start")
def start_call(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("my-customer:call", "contact:call", "customer:call")),
):
    item = cti_service.start_call(db, user, body)
    log_action(
        db, user, "call", "外呼",
        f"外呼 {item.get('phone')} customer={item.get('customerName') or '-'}",
        request=request,
    )
    return ok(item)


@router.post("/calls/end")
def end_call(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("my-customer:call", "contact:call", "customer:call")),
):
    item = cti_service.end_call(db, user, body)
    log_action(
        db, user, "call", "外呼",
        f"挂断 {item.get('phone')} 时长 {item.get('duration')}s",
        request=request,
    )
    return ok(item)


@router.get("/calls")
def list_calls(
    keyword: str = "",
    customerId: int = 0,
    mineOnly: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("call-log:view", "my-customer:call", "contact:call", "customer:call", "system:cti:config")),
):
    return ok(cti_service.list_calls(
        db, user=user, keyword=keyword, customer_id=customerId, mine_only=mineOnly,
    ))


@router.get("/print-templates/service-order")
def get_service_order_print(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:print", "system:print:config")),
):
    return ok(settings_service.get_service_order_print(db))


@router.put("/print-templates/service-order")
def update_service_order_print(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:print:config")),
):
    data = settings_service.update_service_order_print(db, body)
    log_action(db, user, "update", "打印模板", "更新安装服务单打印模板", request=request)
    return ok(data)
