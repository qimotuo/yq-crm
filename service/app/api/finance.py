from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.finance import (
    FinanceCreateRequest,
    FinanceImportRequest,
    FinancePaymentRequest,
    FinanceSendBillRequest,
)
from app.services import finance_service as svc

router = APIRouter(tags=["财务板块"])


@router.get("/finance")
def get_finance_list(
    request: Request,
    paymentStatus: str = "",
    orderNo: str = "",
    id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:view")),
):
    log_action(db, user, "query", "财务", "查询财务列表", request=request)
    return ok(svc.list_finance(paymentStatus, orderNo, id))


@router.post("/finance")
def create_finance(
    body: FinanceCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:create")),
):
    item = svc.create_finance(body.model_dump(), db=db)
    log_action(db, user, "create", "财务", f"新增账单 {item.get('orderNo')}", request=request)
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
    result = svc.import_finance(rows, db=db)
    log_action(db, user, "import", "财务", f"批量导入 {result['count']} 条账单", request=request)
    return ok(result)


@router.get("/finance/payments")
def get_finance_payments(
    id: int = Query(...),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:view")),
):
    return ok(svc.get_payment_records(id))


@router.put("/finance/payment")
def record_finance_payment(
    body: FinancePaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:payment")),
):
    item = svc.record_payment(body.model_dump(), db=db)
    log_action(db, user, "update", "财务", f"录入回款 id={body.id}", request=request)
    return ok(item)


@router.post("/finance/send-bill")
def send_finance_bill(
    body: FinanceSendBillRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("finance:send")),
):
    result = svc.send_bill(body.model_dump())
    log_action(db, user, "update", "财务", f"发送对账单 id={body.id}", request=request)
    return ok(result)
