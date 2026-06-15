from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.stock import (
    SimStockInCreateRequest,
    SimStockInUpdateRequest,
    StockImportRequest,
    StockInCreateRequest,
    StockInUpdateRequest,
    StockOutCreateRequest,
)
from app.services import stock_service as svc

router = APIRouter(tags=["设备出入库"])


@router.get("/stock/in")
def get_stock_in(
    request: Request,
    keyword: str = "",
    supplier: str = "",
    lowStock: bool = False,
    startDate: str = "",
    endDate: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:view")),
):
    log_action(db, user, "query", "设备入库", "查询设备入库列表", request=request)
    return ok(svc.list_stock_in(keyword, supplier, lowStock, startDate, endDate))


@router.post("/stock/in")
def create_stock_in(
    body: StockInCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    item = svc.create_stock_in(body.model_dump())
    log_action(db, user, "create", "设备入库", f"新增入库 {item['inNo']}", request=request)
    return ok(item)


@router.put("/stock/in")
def update_stock_in(
    body: StockInUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    item = svc.update_stock_in(body.model_dump(exclude_unset=True))
    log_action(db, user, "update", "设备入库", f"更新入库 {item['inNo']}", request=request)
    return ok(item)


@router.delete("/stock/in")
def delete_stock_in(
    request: Request,
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    svc.delete_stock_in(id)
    log_action(db, user, "delete", "设备入库", f"删除入库 id={id}", request=request)
    return ok(True)


@router.post("/stock/in/import")
def import_stock_in(
    body: StockImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    result = svc.import_stock_in(body.rows)
    log_action(db, user, "import", "设备入库", f"批量导入 {result['count']} 条", request=request)
    return ok(result)


@router.get("/stock/sim-in")
def get_sim_stock_in(
    request: Request,
    keyword: str = "",
    operator: str = "",
    lowStock: bool = False,
    startDate: str = "",
    endDate: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:view")),
):
    log_action(db, user, "query", "SIM入库", "查询 SIM 卡入库列表", request=request)
    return ok(svc.list_sim_stock_in(keyword, operator, lowStock, startDate, endDate))


@router.post("/stock/sim-in")
def create_sim_stock_in(
    body: SimStockInCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    item = svc.create_sim_stock_in(body.model_dump())
    log_action(db, user, "create", "SIM入库", f"新增 SIM 入库 {item['inNo']}", request=request)
    return ok(item)


@router.put("/stock/sim-in")
def update_sim_stock_in(
    body: SimStockInUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    item = svc.update_sim_stock_in(body.model_dump(exclude_unset=True))
    log_action(db, user, "update", "SIM入库", f"更新 SIM 入库 {item['inNo']}", request=request)
    return ok(item)


@router.delete("/stock/sim-in")
def delete_sim_stock_in(
    request: Request,
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    svc.delete_sim_stock_in(id)
    log_action(db, user, "delete", "SIM入库", f"删除 SIM 入库 id={id}", request=request)
    return ok(True)


@router.post("/stock/sim-in/import")
def import_sim_stock_in(
    body: StockImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:in")),
):
    result = svc.import_sim_stock_in(body.rows)
    log_action(db, user, "import", "SIM入库", f"批量导入 {result['count']} 条", request=request)
    return ok(result)


@router.get("/stock/out")
def get_stock_out(
    request: Request,
    keyword: str = "",
    operator: str = "",
    startDate: str = "",
    endDate: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:view")),
):
    log_action(db, user, "query", "设备出库", "查询设备出库列表", request=request)
    return ok(svc.list_stock_out(keyword, operator, startDate, endDate))


@router.post("/stock/out")
def create_stock_out(
    body: StockOutCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:out")),
):
    item = svc.create_stock_out(body.model_dump(), db=db)
    log_action(db, user, "create", "设备出库", f"新增出库 {item['outNo']}", request=request)
    return ok(item)


@router.post("/stock/out/import")
def import_stock_out(
    body: StockImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("stock:out")),
):
    result = svc.import_stock_out(body.rows, db=db)
    log_action(db, user, "import", "设备出库", f"批量导入 {result['count']} 条", request=request)
    return ok(result)
