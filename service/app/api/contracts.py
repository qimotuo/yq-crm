from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.audit import log_action, log_change
from app.core.data_scope import resolve_sales_names
from app.services.customer_owner import assert_owned_record
from app.core.deps import get_current_user, require_operations
from app.core.exceptions import BizError
from app.core.response import ok
from app.db.models import Contract, User
from app.db.session import get_db
from app.schemas.contract import (
    ContractCreateRequest,
    ContractGenerateRequest,
    ContractImportRequest,
    ContractUpdateRequest,
)
from app.services import contract_service as svc
from app.services.change_log import CONTRACT_LABELS, diff_records

router = APIRouter(tags=["合同管理"])


@router.get("/contracts")
def get_contracts(
    request: Request,
    keyword: str = "",
    status: str = "",
    orderNo: str = "",
    templateKey: str = "",
    storeName: str = "",
    salesName: str = "",
    cityCode: str = "",
    package: str = "",
    signDateFrom: str = "",
    signDateTo: str = "",
    endDateFrom: str = "",
    endDateTo: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("contract:view")),
):
    log_action(db, user, "query", "合同", "查询合同列表", request=request)
    sales_names = resolve_sales_names(db, perms, user)
    return ok(svc.list_contracts(
        db,
        keyword,
        status,
        orderNo,
        sales_names=sales_names,
        template_key=templateKey,
        store_name=storeName,
        sales_name=salesName,
        city_code=cityCode,
        package=package,
        sign_date_from=signDateFrom,
        sign_date_to=signDateTo,
        end_date_from=endDateFrom,
        end_date_to=endDateTo,
    ))


def _owned_contract(db: Session, perms: dict, user: User, contract_id: int) -> Contract:
    row = db.query(Contract).filter(Contract.id == contract_id).first()
    if not row:
        raise BizError("合同不存在")
    assert_owned_record(
        db, perms, user,
        order_no=row.order_no, store=row.store_name, customer_name=row.customer_name, sales_name=row.sales_name,
    )
    return row


@router.get("/contracts/fill-sources")
def fill_sources(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("contract:create", "contract:edit")),
):
    sales_names = resolve_sales_names(db, perms, user)
    return ok(svc.list_fill_sources(db, sales_names))


@router.get("/contracts/preview")
def preview_contract(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("contract:view")),
):
    row = _owned_contract(db, perms, user, id)
    return ok(svc.contract_preview_html(row))


@router.get("/contracts/download")
def download_contract(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("contract:view")),
):
    row = _owned_contract(db, perms, user, id)
    path = svc.contract_abs_path(row)
    log_action(db, user, "export", "合同", f"下载合同 {row.contract_no}", request=request)
    return FileResponse(
        path,
        filename=row.doc_name or path.name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.post("/contracts")
def create_contract(
    body: ContractCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contract:create")),
):
    item = svc.create_contract(db, body.model_dump())
    log_action(db, user, "create", "合同", f"新增合同 {item.get('contractNo')}", request=request)
    return ok(item)


@router.put("/contracts/update")
def update_contract(
    body: ContractUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_operations("contract:edit")),
):
    row = db.query(Contract).filter(Contract.id == body.id).first()
    if not row:
        raise BizError("合同不存在")
    before = svc.contract_to_dict(row)
    assert_owned_record(
        db, perms, user,
        order_no=row.order_no, store=row.store_name, customer_name=row.customer_name, sales_name=row.sales_name,
    )
    item = svc.update_contract(db, body.model_dump())
    template_names = {"zhilian": "基米智连", "jimi6": "基米网6%"}

    def _view(data: dict) -> dict:
        copied = dict(data)
        copied["templateKey"] = template_names.get(copied.get("templateKey") or "", copied.get("templateKey") or "")
        return copied

    log_change(
        db, user, "合同", item["id"], f"修改合同 {item.get('contractNo') or item.get('orderNo')}",
        diff_records(_view(before), _view(item), CONTRACT_LABELS), request=request,
    )
    return ok(item)


@router.post("/contracts/import")
def import_contracts(
    body: ContractImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contract:import")),
):
    rows = [r.model_dump() for r in body.rows]
    result = svc.import_contracts(db, rows)
    log_action(db, user, "import", "合同", f"批量导入 {result['count']} 条合同", request=request)
    return ok(result)


@router.post("/contracts/generate")
def generate_contract(
    body: ContractGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contract:generate")),
):
    item = svc.generate_contract(db, body.orderNo)
    log_action(db, user, "update", "合同", f"生成合同 {body.orderNo}", request=request)
    return ok(item)
