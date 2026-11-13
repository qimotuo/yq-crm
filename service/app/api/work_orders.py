from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action, log_change
from app.core.data_scope import (
    assert_work_order_access,
    can_override_installation_edit,
    filter_work_orders,
    is_all_data_scope,
)
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import notify_service, work_order_service as svc
from app.services.change_log import WORK_ORDER_LABELS, diff_records

router = APIRouter(tags=["工单"])


def _find_user_by_name(db: Session, name: str) -> User | None:
    return db.query(User).filter(User.name == name).first()


def _scoped_list(result: dict, user: User, perms: dict, db: Session) -> dict:
    items = filter_work_orders(result["list"], user, perms, db)
    return {"list": items, "total": len(items)}


@router.get("/work-orders")
def get_work_orders(
    request: Request,
    keyword: str = "",
    status: str = "",
    installer: str = "",
    installDateFrom: str = "",
    installDateTo: str = "",
    deviceModel: str = "",
    mac: str = "",
    iccid: str = "",
    contractNo: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations(
        "workorder:view", "install:view", "dispatch:view", "workorder-query:view",
    )),
):
    filters = {
        "keyword": keyword, "status": status, "installer": installer,
        "installDateFrom": installDateFrom, "installDateTo": installDateTo,
        "deviceModel": deviceModel, "mac": mac, "iccid": iccid, "contractNo": contractNo,
    }
    active = " ".join(f"{k}={v}" for k, v in filters.items() if v) or "全部"
    log_action(db, user, "query", "工单", f"查询工单 {active}"[:500], request=request)
    result = svc.list_work_orders(db, filters=filters)
    return ok(_scoped_list(result, user, perms, db))


@router.post("/work-orders")
def create_work_order(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations(
        "workorder:create", "dispatch:create", "install:create", "workorder-query:create",
    )),
):
    item = svc.create_work_order(db, body, sales_name=user.name)
    log_action(db, user, "create", "工单", f"创建工单 {item['orderNo']}", request=request)
    notify_service.send_from_template(
        db,
        user_id=user.id,
        template_code="workorder_created",
        context={"order_no": item["orderNo"], "customer_name": item.get("customerName", "")},
        source_type="work_order",
        source_id=item["id"],
        path_override=f"/pages/orders/dispatch-detail?id={item['id']}",
    )
    notify_service.notify_users_with_operation(
        db,
        "workorder:dispatch",
        template_code="workorder_need_dispatch",
        context={"order_no": item["orderNo"], "customer_name": item.get("customerName", "")},
        source_type="work_order",
        source_id=item["id"],
        path_override=f"/pages/orders/dispatch-detail?id={item['id']}",
        exclude_user_ids=[user.id],
    )
    return ok(item)


@router.put("/work-orders/dispatch")
def dispatch(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:dispatch", "dispatch:assign")),
):
    order = svc.get_installation(db, body["id"])
    assert_work_order_access(order, user, perms, db)
    item = svc.dispatch_work_order(db, body["id"], body["installer"], operator=user.name)
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
            path_override=f"/pages/orders/dispatch-detail?id={item['id']}",
        )
    return ok(item)


@router.put("/work-orders/status")
def update_status(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations(
        "workorder:edit", "workorder:install", "dispatch:edit", "dispatch:confirm",
        "install:edit", "install:start", "install:fail", "workorder-query:edit",
    )),
):
    order = svc.get_installation(db, body["id"])
    assert_work_order_access(order, user, perms, db)
    item = svc.update_status(db, body["id"], body["status"], body.get("failReason", ""), operator=user.name)
    log_action(db, user, "update", "工单", f"更新状态 {item['orderNo']} → {body['status']}", request=request)
    return ok(item)


@router.put("/work-orders/update")
def update_order(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations(
        "workorder:edit", "dispatch:edit", "install:edit", "workorder-query:edit",
    )),
):
    before = svc.get_installation(db, body["id"])
    assert_work_order_access(before, user, perms, db)
    oid = body.pop("id")
    if not is_all_data_scope(perms):
        body.pop("salesName", None)
    item = svc.update_work_order(db, oid, body)
    log_change(
        db, user, "工单", item["id"], f"修改工单 {item['orderNo']}",
        diff_records(before, item, WORK_ORDER_LABELS), request=request,
    )
    return ok(item)


@router.put("/work-orders/install")
def install_register(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:install", "install:register")),
):
    order = svc.get_installation(db, body["id"])
    assert_work_order_access(order, user, perms, db)
    oid = body.pop("id")
    item = svc.install_register(db, oid, body, operator=user.name)
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
    keyword: str = "",
    status: str = "",
    installDate: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:view", "install:view", "workorder:install")),
):
    log_action(
        db, user, "query", "工单",
        f"查询我的工单 keyword={keyword or '-'} status={status or '-'} installDate={installDate or '-'}",
        request=request,
    )
    name = "" if is_all_data_scope(perms) else (installer or user.name)
    return ok(svc.list_my_orders(db, name, keyword, status, installDate))


@router.get("/work-orders/my-sales")
def my_sales_orders(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:view", "install:view", "workorder:create")),
):
    log_action(db, user, "query", "工单", "查询我的派单", request=request)
    return ok(svc.list_sales_orders(db, user.name))


@router.put("/work-orders/confirm")
def confirm_dispatch(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:install", "install:start")),
):
    order = svc.get_installation(db, body["id"])
    assert_work_order_access(order, user, perms, db)
    item = svc.confirm_dispatch(
        db,
        body["id"],
        body["result"],
        operator=user.name,
        fail_reason=body.get("failReason", ""),
        postpone_date=body.get("postponeDate", ""),
    )
    log_action(
        db, user, "update", "工单",
        f"现场确认 {item['orderNo']} → {body['result']}",
        request=request,
    )
    return ok(item)


@router.delete("/work-orders")
def delete_order(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:delete")),
):
    target = svc.get_installation(db, body["id"])
    assert_work_order_access(target, user, perms, db)
    svc.delete_work_order(db, body["id"])
    log_action(
        db, user, "delete", "工单",
        f"删除工单 {target['orderNo']}",
        request=request,
    )
    return ok(True)


@router.get("/installations/detail")
def get_installation_detail(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:view", "install:view", "workorder:install")),
):
    order = svc.get_installation(db, id)
    assert_work_order_access(order, user, perms, db)
    return ok(order)


@router.post("/installations")
def create_installation(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:install", "install:register")),
):
    item = svc.create_installation(db, body, operator=user.name)
    log_action(db, user, "create", "安装登记", f"新增 {item['orderNo']}", request=request)
    return ok(item)


@router.put("/installations/update")
def update_installation(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:install", "install:register")),
):
    oid = body.pop("id")
    order = svc.get_installation(db, oid)
    assert_work_order_access(order, user, perms, db)
    is_admin = can_override_installation_edit(perms)
    item = svc.update_installation(db, oid, body, operator=user.name, is_admin=is_admin)
    log_action(db, user, "update", "安装登记", f"修改 {item['orderNo']}", request=request)
    return ok(item)


@router.get("/installations/search")
def search_installations(
    request: Request,
    customerName: str = "",
    storeName: str = "",
    installDate: str = "",
    mac: str = "",
    imei: str = "",
    iccid: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("workorder:view", "install:view", "workorder:install")),
):
    log_action(
        db, user, "query", "安装登记",
        f"查询安装登记 customer={customerName or '-'} mac={mac or '-'}",
        request=request,
    )
    result = svc.search_installations(db, customerName, storeName, installDate, mac, imei, iccid)
    return ok(_scoped_list(result, user, perms, db))


@router.get("/installers")
def get_installers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations(
        "workorder:dispatch", "dispatch:assign", "dispatch:view", "workorder:view",
    )),
):
    return ok(svc.list_installers(db))
