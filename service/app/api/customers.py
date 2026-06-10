from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import customer_service as svc

router = APIRouter(tags=["客户管理"])


@router.get("/customers")
def get_customers(
    request: Request,
    keyword: str = "",
    salesName: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("customer:view")),
):
    sales = salesName
    if user.role_code == "sales" or perms.get("dataScope") == "SELF":
        sales = user.name
    log_action(db, user, "query", "客户", f"查询我的客户 keyword={keyword or '-'}", request=request)
    return ok(svc.list_customers(keyword, sales))


@router.get("/customers/detail")
def get_customer_detail(
    id: int = Query(...),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    item = svc.get_customer(id)
    return ok(item)


@router.put("/customers/update")
def update_customer(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    item = svc.update_customer(body)
    log_action(db, user, "update", "客户", f"更新客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.get("/public-pool")
def get_public_pool(
    request: Request,
    keyword: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    log_action(db, user, "query", "公海", f"查询公海客户 keyword={keyword or '-'}", request=request)
    return ok(svc.list_public_pool(keyword))


@router.post("/public-pool")
def create_public_pool(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:create")),
):
    item = svc.create_public_pool_customer(body)
    log_action(db, user, "create", "公海", f"新增公海客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.post("/public-pool/claim")
def claim_public_pool(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:claim")),
):
    item = svc.claim_public_pool(body["id"], user.name)
    log_action(db, user, "claim", "公海", f"领取客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.post("/public-pool/return")
def return_public_pool(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:return")),
):
    svc.return_to_public_pool(body, user.name)
    log_action(db, user, "return", "公海", f"退回客户 {body.get('customerName', body.get('id'))}", request=request)
    return ok(True)


@router.post("/public-pool/import")
def import_public_pool(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:import")),
):
    result = svc.import_public_pool()
    log_action(db, user, "import", "公海", f"导入公海客户 {result['count']} 条", request=request)
    return ok(result)


@router.get("/follow-ups")
def get_follow_ups(
    customerId: int = 0,
    salesName: str = "",
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("customer:view")),
):
    sales = salesName
    if user.role_code == "sales":
        sales = user.name
    return ok(svc.list_follow_ups(customerId, sales))


@router.post("/follow-ups")
def create_follow_up(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:follow")),
):
    body.setdefault("salesName", user.name)
    item = svc.create_follow_up(body)
    log_action(db, user, "create", "跟进", f"跟进客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.get("/contacts")
def get_contacts(
    keyword: str = "",
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    return ok(svc.list_contacts(keyword))


@router.post("/contacts")
def create_contact(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    item = svc.create_contact(body)
    log_action(db, user, "create", "联系人", f"新增联系人 {item.get('name')}", request=request)
    return ok(item)


@router.put("/contacts")
def update_contact(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    item = svc.update_contact(body)
    log_action(db, user, "update", "联系人", f"更新联系人 {item.get('name')}", request=request)
    return ok(item)


@router.post("/contacts/import")
def import_contacts(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:import")),
):
    result = svc.import_contacts()
    log_action(db, user, "import", "联系人", f"导入联系人 {result['count']} 条", request=request)
    return ok(result)


@router.get("/pool/config")
def get_pool_config(
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    return ok(svc.get_pool_config())


@router.put("/pool/config")
def update_pool_config(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    data = svc.update_pool_config(body)
    log_action(db, user, "update", "公海池", "更新公海池配置", request=request)
    return ok(data)


@router.get("/pool/return-logs")
def get_return_logs(
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    return ok(svc.list_return_logs())
