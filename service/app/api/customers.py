from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.data_scope import get_data_scope, resolve_sales_filter
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import customer_service as svc
from app.services import follow_up_service as follow_svc
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerImportRequest,
    CustomerUpdateRequest,
    FollowUpCreateRequest,
)

router = APIRouter(tags=["客户管理"])


@router.get("/customers")
def get_customers(
    request: Request,
    keyword: str = "",
    salesName: str = "",
    contactStatus: str = "",
    invoiceType: str = "",
    orderNo: str = "",
    mac: str = "",
    imei: str = "",
    iccid: str = "",
    operator: str = "",
    installed: str = "",
    hasPayment: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("customer:view")),
):
    sales = resolve_sales_filter(perms, user, salesName)
    log_action(db, user, "query", "客户", f"查询我的客户 keyword={keyword or '-'}", request=request)
    return ok(svc.list_customers(
        db, keyword, sales, contactStatus, invoiceType, orderNo, mac, imei, iccid, operator, installed, hasPayment,
    ))


@router.get("/customers/detail")
def get_customer_detail(
    id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    item = svc.get_customer(db, id)
    return ok(item)


@router.post("/customers")
def create_customer(
    body: CustomerCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("customer:create")),
):
    sales_name = user.name if get_data_scope(perms) == "SELF" else body.salesName
    item = svc.create_customer(db, body.model_dump(), sales_name)
    log_action(db, user, "create", "客户", f"新增客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.put("/customers/update")
def update_customer(
    body: CustomerUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    item = svc.update_customer(db, body.model_dump(exclude_unset=True))
    log_action(db, user, "update", "客户", f"更新客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.delete("/customers")
def delete_customer(
    request: Request,
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:view")),
):
    svc.delete_customer(db, id)
    log_action(db, user, "delete", "客户", f"删除客户 id={id}", request=request)
    return ok(True)


@router.post("/customers/import")
def import_customers(
    body: CustomerImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:import")),
):
    result = svc.import_customers(db, body.rows)
    log_action(db, user, "import", "客户", f"批量导入合作客户 {result['count']} 条", request=request)
    return ok(result)


@router.post("/customers/my-import")
def import_my_customers(
    body: CustomerImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:import")),
):
    result = svc.import_my_customers(db, body.rows, user.name)
    log_action(db, user, "import", "我的客户", f"批量导入 {result['count']} 条", request=request)
    return ok(result)


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
    item = svc.claim_public_pool(db, body["id"], user.name)
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
    svc.return_to_public_pool(db, body, user.name)
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
    request: Request,
    customerId: int = 0,
    salesName: str = "",
    type: str = "",
    keyword: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("customer:view")),
):
    log_action(
        db, user, "query", "跟进",
        f"查询跟进记录 customerId={customerId or '-'} type={type or '-'} status={status or '-'}",
        request=request,
    )
    return ok(follow_svc.list_follow_ups(db, user, customerId, salesName, type, keyword, status, perms))


@router.post("/follow-ups")
def create_follow_up(
    body: FollowUpCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("customer:follow")),
):
    data = body.model_dump()
    data.setdefault("salesName", user.name)
    item = follow_svc.create_follow_up(db, user, data)
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
