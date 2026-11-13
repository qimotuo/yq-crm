from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action, log_change
from app.core.data_scope import assert_customer_access, is_all_data_scope, resolve_sales_names
from app.core.deps import get_current_user, require_operations
from app.core.exceptions import BizError
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import customer_owner as owner_svc
from app.services import customer_service as svc
from app.services.change_log import CUSTOMER_LABELS, diff_records
from app.services import follow_up_service as follow_svc
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerImportRequest,
    CustomerTransferRequest,
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
    perms: dict = Depends(require_operations("my-customer:view", "customer:view", "follow:view")),
):
    sales_names = resolve_sales_names(db, perms, user, salesName)
    log_action(db, user, "query", "客户", f"查询我的客户 keyword={keyword or '-'}", request=request)
    return ok(svc.list_customers(
        db, keyword, salesName if sales_names is None else "", contactStatus, invoiceType, orderNo,
        mac, imei, iccid, operator, installed, hasPayment, sales_names=sales_names,
    ))


@router.get("/customers/sales-options")
def get_sales_options(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("my-customer:view", "customer:view", "my-customer:create", "customer:create")),
):
    return ok({"list": owner_svc.list_sales_options(db, user, perms)})


@router.get("/customers/owner-review")
def get_owner_review(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("my-customer:view", "customer:view")),
):
    if not is_all_data_scope(perms):
        raise BizError("无权查看待确认客户", 403)
    return ok(owner_svc.list_owner_review(db))


@router.post("/customers/transfer")
def transfer_customer(
    body: CustomerTransferRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("my-customer:edit", "customer:edit")),
):
    if not is_all_data_scope(perms):
        raise BizError("无权转交客户", 403)
    before = svc.get_customer(db, body.id)
    if not before:
        raise BizError("客户不存在", 404)
    result = owner_svc.transfer_customer(db, body.id, body.salesName, body.reason)
    log_action(
        db, user, "transfer", "客户",
        f"转交客户 {result.get('customerName')} {result.get('fromSalesName') or '待确认'} → {result.get('salesName')}"
        + (f"（{body.reason}）" if body.reason else ""),
        request=request,
    )
    log_change(
        db, user, "客户", result["id"], f"转交客户 {result.get('customerName')}",
        diff_records(before, {**before, "salesName": result["salesName"]}, CUSTOMER_LABELS),
        request=request,
    )
    return ok(result)


@router.get("/customers/detail")
def get_customer_detail(
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("my-customer:view", "customer:view")),
):
    item = svc.get_customer(db, id)
    assert_customer_access(item, user, perms, db)
    return ok(item)


@router.post("/customers")
def create_customer(
    body: CustomerCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("my-customer:create", "customer:create")),
):
    sales_name = owner_svc.resolve_owner_name(db, body.salesName, user=user, perms=perms)
    item = svc.create_customer(db, body.model_dump(), sales_name)
    log_action(db, user, "create", "客户", f"新增客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.put("/customers/update")
def update_customer(
    body: CustomerUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("my-customer:edit", "customer:edit")),
):
    data = body.model_dump(exclude_unset=True)
    before = assert_customer_access(svc.get_customer(db, data["id"]), user, perms, db)
    if "salesName" in data:
        new_name = (data.pop("salesName") or "").strip()
        if not new_name:
            raise BizError("负责销售为必填项")
        changed = new_name != (before.get("salesName") or "") or before.get("ownerStatus") == "pending"
        if changed:
            if not is_all_data_scope(perms):
                raise BizError("不能修改负责销售", 403)
            result = owner_svc.transfer_customer(db, data["id"], new_name)
            log_action(
                db, user, "transfer", "客户",
                f"转交客户 {result.get('customerName')} {result.get('fromSalesName') or '待确认'} → {result.get('salesName')}",
                request=request,
            )
            before = {**before, "salesName": new_name, "ownerStatus": "confirmed"}
    item = svc.update_customer(db, data)
    log_change(
        db, user, "客户", item["id"], f"修改客户 {item.get('customerName')}",
        diff_records(before, item, CUSTOMER_LABELS), request=request,
    )
    return ok(item)


@router.delete("/customers")
def delete_customer(
    request: Request,
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("my-customer:edit", "customer:edit", "customer:delete")),
):
    assert_customer_access(svc.get_customer(db, id), user, perms, db)
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
    __: dict = Depends(require_operations("my-customer:import", "customer:import")),
):
    result = svc.import_my_customers(db, body.rows, user.name, user.id)
    log_action(db, user, "import", "我的客户", f"批量导入 {result['count']} 条", request=request)
    return ok(result)


@router.get("/public-pool")
def get_public_pool(
    request: Request,
    keyword: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("public-pool:view", "customer:view")),
):
    log_action(db, user, "query", "公海", f"查询公海客户 keyword={keyword or '-'}", request=request)
    return ok(svc.list_public_pool(db, keyword))


@router.post("/public-pool")
def create_public_pool(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("public-pool:create", "customer:create")),
):
    item = svc.create_public_pool_customer(db, body)
    log_action(db, user, "create", "公海", f"新增公海客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.post("/public-pool/claim")
def claim_public_pool(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("public-pool:claim", "customer:claim")),
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
    perms: dict = Depends(require_operations("my-customer:return", "customer:return")),
):
    if body.get("id"):
        assert_customer_access(svc.get_customer(db, body["id"]), user, perms, db)
    svc.return_to_public_pool(db, body, user.name)
    log_action(db, user, "return", "公海", f"退回客户 {body.get('customerName', body.get('id'))}", request=request)
    return ok(True)


@router.post("/public-pool/import")
def import_public_pool(
    body: CustomerImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("public-pool:import", "customer:import")),
):
    result = svc.import_public_pool(db, body.rows)
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
    perms: dict = Depends(require_operations("follow:view", "my-customer:view", "customer:view")),
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
    perms: dict = Depends(require_operations("follow:create", "my-customer:follow", "customer:follow")),
):
    data = body.model_dump()
    if data.get("customerId"):
        customer = assert_customer_access(svc.get_customer(db, data["customerId"]), user, perms, db)
        if customer.get("ownerStatus") == "pending":
            raise BizError("该客户归属待确认，不能跟进")
        data["salesName"] = customer.get("salesName") or user.name
    else:
        data.setdefault("salesName", user.name)
    item = follow_svc.create_follow_up(db, user, data)
    log_action(db, user, "create", "跟进", f"跟进客户 {item.get('customerName')}", request=request)
    return ok(item)


@router.get("/contacts")
def get_contacts(
    keyword: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contact:view", "customer:view")),
):
    return ok(svc.list_contacts(db, keyword))


@router.post("/contacts")
def create_contact(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contact:create", "customer:create")),
):
    item = svc.create_contact(db, body)
    log_action(db, user, "create", "联系人", f"新增联系人 {item.get('name')}", request=request)
    return ok(item)


@router.put("/contacts")
def update_contact(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contact:edit", "customer:edit")),
):
    item = svc.update_contact(db, body)
    log_action(db, user, "update", "联系人", f"更新联系人 {item.get('name')}", request=request)
    return ok(item)


@router.post("/contacts/import")
def import_contacts(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contact:import", "customer:import")),
):
    result = svc.import_contacts(db)
    log_action(db, user, "import", "联系人", f"导入联系人 {result['count']} 条", request=request)
    return ok(result)


@router.get("/pool/config")
def get_pool_config(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("pool-config:view")),
):
    return ok(svc.get_pool_config(db))


@router.put("/pool/config")
def update_pool_config(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("pool-config:edit")),
):
    data = svc.update_pool_config(db, body)
    log_action(db, user, "update", "公海池", "更新公海池配置", request=request)
    return ok(data)


@router.get("/pool/return-logs")
def get_return_logs(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("pool-config:view")),
):
    return ok(svc.list_return_logs(db))


@router.post("/pool/auto-return/run")
def run_pool_auto_return(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("pool-config:scan", "pool-config:edit")),
):
    result = svc.auto_return_stale_customers(db)
    log_action(
        db, user, "return", "公海池",
        f"手动触发自动退回扫描，退回 {result.get('count', 0)} 条",
        request=request,
    )
    return ok(result)
