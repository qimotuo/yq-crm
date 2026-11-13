from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action, log_change
from app.core.data_scope import resolve_sales_names
from app.services.customer_owner import assert_owned_record
from app.core.deps import get_current_user, require_operations
from app.core.exceptions import BizError
from app.core.response import ok
from app.db.models import Finance, User
from app.db.session import get_db
from app.schemas.finance import (
    FinanceCreateRequest,
    FinanceImportRequest,
    FinancePaymentRequest,
    FinanceSendBillRequest,
    FinanceUpdateRequest,
)
from app.services import finance_service as svc
from app.services.change_log import FINANCE_LABELS, diff_records

router = APIRouter(tags=["财务板块"])


@router.get("/finance")
def get_finance_list(
    request: Request,
    paymentStatus: str = "",
    orderNo: str = "",
    keyword: str = "",
    invoiceStatus: str = "",
    contractStatus: str = "",
    salesName: str = "",
    billMonth: str = "",
    contactStatus: str = "",
    assetHealth: str = "",
    id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("finance:view")),
):
    log_action(db, user, "query", "财务", "查询财务列表", request=request)
    sales_names = resolve_sales_names(db, perms, user, salesName)
    return ok(svc.list_finance(
        db,
        payment_status=paymentStatus,
        order_no=orderNo,
        finance_id=id,
        keyword=keyword,
        invoice_status=invoiceStatus,
        contract_status=contractStatus,
        sales_name=salesName if sales_names is None else "",
        bill_month=billMonth,
        sales_names=sales_names,
        contact_status=contactStatus,
        asset_health=assetHealth,
    ))


@router.post("/finance")
def create_finance(
    body: FinanceCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:create")),
):
    item = svc.create_finance(db, body.model_dump())
    log_action(db, user, "create", "财务", f"新增账单 {item.get('orderNo')}", request=request)
    return ok(item)


@router.put("/finance/update")
def update_finance(
    body: FinanceUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("finance:edit")),
):
    row = db.query(Finance).filter(Finance.id == body.id).first()
    if not row:
        raise BizError("财务账单不存在")
    before = svc.finance_to_dict(row)
    assert_owned_record(
        db, perms, user,
        order_no=row.order_no, store=row.store_name, customer_name=row.customer_name, sales_name=row.sales_name,
    )
    item = svc.update_finance(db, body.model_dump())
    log_change(
        db, user, "财务", item["id"], f"修改账单 {item.get('orderNo')}",
        diff_records(before, item, FINANCE_LABELS), request=request,
    )
    return ok(item)


@router.post("/finance/import")
def import_finance(
    body: FinanceImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:import")),
):
    rows = [r.model_dump() for r in body.rows]
    result = svc.import_finance(db, rows)
    log_action(db, user, "import", "财务", f"批量导入 {result['count']} 条账单", request=request)
    return ok(result)


@router.get("/finance/payments")
def get_finance_payments(
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("finance:view", "customer:payment-log", "customer:view")),
):
    row = db.query(Finance).filter(Finance.id == id).first()
    if not row:
        raise BizError("财务账单不存在")
    assert_owned_record(
        db, perms, user,
        order_no=row.order_no, store=row.store_name, customer_name=row.customer_name, sales_name=row.sales_name,
    )
    return ok(svc.get_payment_records(db, id))


@router.put("/finance/payment")
def record_finance_payment(
    body: FinancePaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("finance:payment", "customer:payment", "integrated:payment")),
):
    row = db.query(Finance).filter(Finance.id == body.id).first()
    if not row:
        raise BizError("财务账单不存在")
    assert_owned_record(
        db, perms, user,
        order_no=row.order_no, store=row.store_name, customer_name=row.customer_name, sales_name=row.sales_name,
    )
    item = svc.record_payment(db, body.model_dump())
    log_action(db, user, "update", "财务", f"录入回款 id={body.id}", request=request)
    return ok(item)


@router.post("/finance/send-bill")
def send_finance_bill(
    body: FinanceSendBillRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:send", "integrated:send")),
):
    result = svc.send_bill(db, body.model_dump(), operator_name=user.name)
    log_action(db, user, "update", "财务", f"发送对账单 id={body.id}", request=request)
    return ok(result)
