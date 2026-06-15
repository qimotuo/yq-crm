from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.contract import (
    ContractCreateRequest,
    ContractGenerateRequest,
    ContractImportRequest,
)
from app.services import contract_service as svc

router = APIRouter(tags=["合同管理"])


@router.get("/contracts")
def get_contracts(
    request: Request,
    keyword: str = "",
    status: str = "",
    orderNo: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contract:view")),
):
    log_action(db, user, "query", "合同", "查询合同列表", request=request)
    return ok(svc.list_contracts(keyword, status, orderNo))


@router.post("/contracts")
def create_contract(
    body: ContractCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("contract:create")),
):
    item = svc.create_contract(body.model_dump())
    log_action(db, user, "create", "合同", f"新增合同 {item.get('contractNo')}", request=request)
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
    result = svc.import_contracts(rows)
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
    item = svc.generate_contract(body.orderNo)
    log_action(db, user, "update", "合同", f"生成合同 {body.orderNo}", request=request)
    return ok(item)
