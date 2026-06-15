from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services import ledger_service as svc

router = APIRouter(tags=["账本"])


@router.get("/account-ledger")
def get_account_ledger(
    request: Request,
    section: str = "",
    month: str = "",
    direction: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("account-ledger:view")),
):
    log_action(db, user, "query", "账户账本", "查询账户账本", request=request)
    return ok(svc.list_account_ledger(section, month, direction))


@router.post("/account-ledger")
def create_account_ledger(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("account-ledger:create")),
):
    item = svc.create_account_ledger(body, user.name)
    log_action(db, user, "create", "账户账本", f"记账 {item['category']} {item['amount']}", request=request)
    return ok(item)


@router.delete("/account-ledger")
def delete_account_ledger(
    request: Request,
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("account-ledger:delete")),
):
    svc.delete_account_ledger(id)
    log_action(db, user, "delete", "账户账本", f"删除记录 id={id}", request=request)
    return ok({"ok": True})


@router.get("/admin-ledger")
def get_admin_ledger(
    request: Request,
    month: str = "",
    category: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("admin-ledger:view")),
):
    log_action(db, user, "query", "行政账本", "查询行政账本", request=request)
    return ok(svc.list_admin_ledger(month, category))


@router.post("/admin-ledger")
def create_admin_ledger(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("admin-ledger:create")),
):
    item = svc.create_admin_ledger(body, user.name)
    log_action(db, user, "create", "行政账本", f"记账 {item['category']} {item['amount']}", request=request)
    return ok(item)


@router.delete("/admin-ledger")
def delete_admin_ledger(
    request: Request,
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("admin-ledger:delete")),
):
    svc.delete_admin_ledger(id)
    log_action(db, user, "delete", "行政账本", f"删除记录 id={id}", request=request)
    return ok({"ok": True})
