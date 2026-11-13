from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.audit import log_action, log_change
from app.core.data_scope import resolve_sales_names
from pydantic import BaseModel

from app.core.deps import get_current_user, require_operations
from app.core.exceptions import BizError
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import integrated_service as svc
from app.services.change_log import INTEGRATED_LABELS, diff_records

router = APIRouter(tags=["关联查询"])


class IntegratedImportRequest(BaseModel):
    rows: list[dict]


class IntegratedUpdateRequest(BaseModel):
    id: int
    salesName: str = ""
    storeName: str = ""
    customerName: str = ""
    contact: str = ""
    phone: str = ""
    contactStatus: str = ""
    installer: str = ""
    installDate: str = ""
    deviceSupplier: str = ""
    deviceModel: str = ""
    deviceCost: str = ""
    mac: str = ""
    imei: str = ""
    simSupplier: str = ""
    telecomNo: str = ""
    mobileNo: str = ""
    oldCardNo: str = ""
    cardPackage: str = ""
    cardCost: str = ""
    cardExpireDate: str = ""
    contractPeriod: str = ""
    billMonth: str = ""
    price: str = ""
    invoiceStatus: str = ""
    paymentPlanDate: str = ""
    totalAmount: float = 0


@router.get("/integrated")
def get_integrated_list(
    request: Request,
    keyword: str = "",
    salesName: str = "",
    billMonth: str = "",
    paymentStatus: str = "",
    invoiceStatus: str = "",
    contractStatus: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("integrated:view")),
):
    log_action(db, user, "query", "关联查询", f"关联查询 keyword={keyword}", request=request)
    sales_names = resolve_sales_names(db, perms, user)
    return ok(svc.list_integrated(
        db,
        keyword=keyword,
        sales_names=sales_names,
        sales_name=salesName,
        bill_month=billMonth,
        payment_status=paymentStatus,
        invoice_status=invoiceStatus,
        contract_status=contractStatus,
    ))


@router.put("/integrated/update")
def update_integrated(
    body: IntegratedUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("integrated:edit")),
):
    before = svc.get_integrated_item(db, body.id)
    names = resolve_sales_names(db, perms, user)
    if names is not None and (before.get("salesName") or "") not in set(names):
        raise BizError("无权修改该记录", 403)
    item = svc.update_integrated(db, body.model_dump())
    log_change(
        db, user, "关联", item["id"], f"修改关联 {item.get('orderNo') or item.get('customerName')}",
        diff_records(before, item, INTEGRATED_LABELS), request=request,
    )
    return ok(item)


@router.post("/integrated/import")
def import_integrated(
    body: IntegratedImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("integrated:import")),
):
    result = svc.import_integrated(db, body.rows, operator=user.name)
    log_action(
        db, user, "import", "关联查询",
        f"关联导入 新建 {result['created']} 条，更新 {result['updated']} 条，失败 {len(result['errors'])} 条",
        request=request,
    )
    return ok(result)


@router.post("/integrated/import/stream")
def import_integrated_stream(
    body: IntegratedImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("integrated:import")),
):
    def gen():
        created = updated = failed = 0
        try:
            for event in svc.iter_import_integrated(db, body.rows, operator=user.name):
                if event["type"] == "done":
                    created, updated, failed = event["created"], event["updated"], event["failed"]
                yield svc.sse_event(event)
            log_action(
                db, user, "import", "关联查询",
                f"关联导入 新建 {created} 条，更新 {updated} 条，失败 {failed} 条",
                request=request,
            )
        except Exception as exc:
            db.rollback()
            yield svc.sse_event({"type": "fatal", "message": svc._import_error_message(exc)})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
