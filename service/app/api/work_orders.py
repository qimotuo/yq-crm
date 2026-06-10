from fastapi import APIRouter, Depends

from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.services import work_order_service as svc

router = APIRouter(tags=["工单"])


@router.get("/work-orders")
def get_work_orders(
    keyword: str = "",
    status: str = "",
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:view")),
):
    return ok(svc.list_work_orders(keyword, status))


@router.post("/work-orders")
def create_work_order(
    body: dict,
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:create")),
):
    return ok(svc.create_work_order(body))


@router.put("/work-orders/dispatch")
def dispatch(
    body: dict,
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:dispatch")),
):
    return ok(svc.dispatch_work_order(body["id"], body["installer"]))


@router.put("/work-orders/status")
def update_status(
    body: dict,
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:edit", "workorder:install")),
):
    return ok(svc.update_status(body["id"], body["status"], body.get("failReason", "")))


@router.put("/work-orders/update")
def update_order(
    body: dict,
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:edit")),
):
    oid = body.pop("id")
    return ok(svc.update_work_order(oid, body))


@router.put("/work-orders/install")
def install_register(
    body: dict,
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:install")),
):
    oid = body.pop("id")
    body["status"] = "已安装"
    return ok(svc.update_work_order(oid, body))


@router.get("/work-orders/my")
def my_orders(
    installer: str = "",
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:view", "workorder:install")),
):
    items = svc.list_work_orders()["list"]
    if installer:
        items = [o for o in items if o.get("installer") == installer]
    else:
        items = [o for o in items if o["status"] in ("已派工", "安装中") or o.get("installer")]
    return ok({"list": items, "total": len(items)})


@router.delete("/work-orders")
def delete_order(
    body: dict,
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:delete")),
):
    svc.delete_work_order(body["id"])
    return ok(True)


@router.get("/installers")
def get_installers(
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("workorder:dispatch", "workorder:view")),
):
    return ok(svc.list_installers())
