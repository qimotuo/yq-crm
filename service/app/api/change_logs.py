from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.data_scope import assert_customer_access, assert_work_order_access, resolve_sales_names
from app.core.deps import get_current_permissions, get_current_user
from app.core.exceptions import BizError
from app.core.response import ok
from app.db.models import Contract, Finance, User
from app.db.session import get_db
from app.services import audit_service, customer_service, work_order_service

router = APIRouter(tags=["修改记录"])


def _int_id(value: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise BizError("记录不存在", 404) from None


def _need(perms: dict, *codes: str) -> None:
    ops = perms.get("operations") or []
    if "*" in ops or any(code in ops for code in codes):
        return
    raise BizError("无操作权限", 403)


def _assert_sales(db: Session, perms: dict, user: User, sales_name: str) -> None:
    names = resolve_sales_names(db, perms, user)
    if names is not None and (sales_name or "") not in set(names):
        raise BizError("无权查看该修改记录", 403)


@router.get("/change-logs")
def get_change_logs(
    module: str = Query(...),
    targetId: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    if module == "客户":
        _need(perms, "customer:view")
        assert_customer_access(customer_service.get_customer(db, _int_id(targetId)), user, perms, db)
    elif module == "工单":
        _need(perms, "workorder:view")
        assert_work_order_access(work_order_service.get_installation(db, _int_id(targetId)), user, perms, db)
    elif module == "财务":
        _need(perms, "finance:view")
        row = db.query(Finance).filter(Finance.id == _int_id(targetId)).first()
        if not row:
            raise BizError("财务账单不存在", 404)
        _assert_sales(db, perms, user, row.sales_name)
    elif module == "合同":
        _need(perms, "contract:view")
        row = db.query(Contract).filter(Contract.id == _int_id(targetId)).first()
        if not row:
            raise BizError("合同不存在", 404)
        _assert_sales(db, perms, user, row.sales_name)
    elif module == "关联":
        menus = perms.get("menuKeys") or []
        if "*" not in menus and "/integrated" not in menus:
            raise BizError("无菜单权限", 403)
        row = db.query(Finance).filter(Finance.id == _int_id(targetId)).first()
        if not row:
            raise BizError("关联记录不存在", 404)
        _assert_sales(db, perms, user, row.sales_name)
    else:
        raise BizError("不支持的模块")
    return ok(audit_service.list_changes(db, module=module, target_id=targetId))
