from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import notify_service, work_order_service as svc

router = APIRouter(tags=["工单"])


def _find_user_by_name(db: Session, name: str) -> User | None:
    return db.query(User).filter(User.name == name).first()


@router.get("/work-orders")
def get_work_orders(
    request: Request,
    keyword: str = "",
    status: str = "",
    mac: str = "",
    iccid: str = "",
    contractNo: str = "",
    deviceModel: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:view")),
):
    log_action(
        db, user, "query", "工单",
        f"查询工单 keyword={keyword or '-'} status={status or '-'}",
        request=request,
    )
    return ok(svc.list_work_orders(keyword, status, mac, iccid, contractNo, deviceModel))


@router.post("/work-orders")
def create_work_order(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:create")),
):
    item = svc.create_work_order(body, sales_name=user.name)
    log_action(db, user, "create", "工单", f"创建工单 {item['orderNo']}", request=request)
    notify_service.send_from_template(
        db,
        user_id=user.id,
        template_code="workorder_created",
        context={"order_no": item["orderNo"], "customer_name": item.get("customerName", "")},
        source_type="work_order",
        source_id=item["id"],
    )
    return ok(item)


@router.put("/work-orders/dispatch")
def dispatch(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:dispatch")),
):
    item = svc.dispatch_work_order(body["id"], body["installer"], operator=user.name)
    log_action(
        db, user, "dispatch", "工单",
        f"派工 {item['orderNo']} → {body['installer']}",
        request=request,
    )
    installer_user = _find_user_by_name(db, body["installer"])
    if installer_user:
        notify_service.send_from_template(
            db,
            user_id=installer_user.id,
            template_code="workorder_dispatch",
            context={"order_no": item["orderNo"], "installer": body["installer"]},
            source_type="work_order",
            source_id=item["id"],
        )
    return ok(item)


@router.put("/work-orders/status")
def update_status(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:edit", "workorder:install")),
):
    item = svc.update_status(body["id"], body["status"], body.get("failReason", ""), operator=user.name)
    log_action(db, user, "update", "工单", f"更新状态 {item['orderNo']} → {body['status']}", request=request)
    return ok(item)


@router.put("/work-orders/update")
def update_order(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:edit")),
):
    oid = body.pop("id")
    item = svc.update_work_order(oid, body)
    log_action(db, user, "update", "工单", f"编辑工单 {item['orderNo']}", request=request)
    return ok(item)


@router.put("/work-orders/install")
def install_register(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:install")),
):
    oid = body.pop("id")
    item = svc.install_register(oid, body, operator=user.name)
    log_action(db, user, "install", "工单", f"安装登记 {item['orderNo']}", request=request)
    notify_service.send_from_template(
        db,
        user_id=user.id,
        template_code="workorder_install",
        context={"order_no": item["orderNo"]},
        source_type="work_order",
        source_id=item["id"],
    )
    return ok(item)


@router.get("/work-orders/my")
def my_orders(
    request: Request,
    installer: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:view", "workorder:install")),
):
    log_action(db, user, "query", "工单", "查询我的工单", request=request)
    name = installer or user.name
    return ok(svc.list_my_orders(name))


@router.delete("/work-orders")
def delete_order(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:delete")),
):
    orders = svc.list_work_orders()["list"]
    target = next((o for o in orders if o["id"] == body["id"]), None)
    svc.delete_work_order(body["id"])
    log_action(
        db, user, "delete", "工单",
        f"删除工单 {target['orderNo'] if target else body['id']}",
        request=request,
    )
    return ok(True)


@router.get("/installers")
def get_installers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:dispatch", "workorder:view")),
):
    return ok(svc.list_installers())
