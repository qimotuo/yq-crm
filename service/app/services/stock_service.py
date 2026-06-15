from datetime import date, datetime

from sqlalchemy.orm import Session

from pydantic import ValidationError

from app.core.exceptions import BizError
from app.data.store import store
from app.services import work_order_service as work_order_svc
from app.schemas.stock import (
    SimStockInImportRow,
    StockInImportRow,
    StockOutImportRow,
)

_OPERATORS = {"中国移动", "中国电信", "中国联通"}

_OUT_KEYWORD_FIELDS = (
    "outNo", "orderNo", "storeName", "customerName", "model",
    "imei", "mac", "iccid", "iccid2", "receiver", "remark",
)
_IN_KEYWORD_FIELDS = ("inNo", "supplier", "model", "imei", "mac", "receiver", "remark")
_SIM_KEYWORD_FIELDS = ("inNo", "supplier", "operator", "iccid", "receiver", "remark")


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _normalize_datetime(value: str | None) -> str:
    if not value:
        return _now()
    text = str(value).strip()
    if len(text) <= 10:
        return f"{text} 00:00:00"
    return text


def _next_id(items: list) -> int:
    return max((i["id"] for i in items), default=0) + 1


def _gen_in_no(items: list) -> str:
    d = date.today().strftime("%Y%m%d")
    seq = len(items) + 1
    return f"RK{d}{seq:03d}"


def _gen_out_no(items: list) -> str:
    d = date.today().strftime("%Y%m%d")
    seq = len(items) + 1
    return f"CK{d}{seq:03d}"


def _find_work_order(db: Session | None, order_no: str) -> dict | None:
    if db is not None:
        return work_order_svc.find_work_order_by_order_no(db, order_no)
    return next((o for o in store.work_orders if o.get("orderNo") == order_no), None)


def _match_keyword(row: dict, keyword: str, fields: tuple[str, ...]) -> bool:
    if not keyword or not keyword.strip():
        return True
    kw = keyword.strip().lower()
    return any(kw in str(row.get(f) or "").lower() for f in fields)


def _match_date_range(date_str: str | None, start: str, end: str) -> bool:
    if not start and not end:
        return True
    if not date_str:
        return False
    d = str(date_str)[:10]
    if start and d < start:
        return False
    if end and d > end:
        return False
    return True


def _filter_list(
    items: list,
    *,
    keyword: str = "",
    operator: str = "",
    supplier: str = "",
    low_stock: bool = False,
    start_date: str = "",
    end_date: str = "",
    date_field: str = "inDate",
    keyword_fields: tuple[str, ...] = _IN_KEYWORD_FIELDS,
) -> list:
    result = items
    if operator:
        result = [r for r in result if r.get("operator") == operator]
    if supplier:
        result = [r for r in result if r.get("supplier") == supplier]
    if low_stock:
        result = [r for r in result if (r.get("stockQty") or 0) <= 5]
    if start_date or end_date:
        result = [r for r in result if _match_date_range(r.get(date_field), start_date, end_date)]
    if keyword and keyword.strip():
        result = [r for r in result if _match_keyword(r, keyword, keyword_fields)]
    return result


def _validate_import_rows(model_cls, rows: list) -> list[dict]:
    if not rows:
        raise BizError("导入数据为空")
    validated = []
    for idx, row in enumerate(rows, start=2):
        try:
            validated.append(model_cls.model_validate(row).model_dump())
        except ValidationError as e:
            msg = e.errors()[0].get("msg", "数据格式错误")
            raise BizError(f"第 {idx} 行：{msg}") from e
    return validated


def list_stock_in(
    keyword: str = "",
    supplier: str = "",
    low_stock: bool = False,
    start_date: str = "",
    end_date: str = "",
) -> dict:
    items = _filter_list(
        store.stock_in,
        keyword=keyword,
        supplier=supplier,
        low_stock=low_stock,
        start_date=start_date,
        end_date=end_date,
        keyword_fields=_IN_KEYWORD_FIELDS,
    )
    return {"list": items, "total": len(items)}


def create_stock_in(body: dict) -> dict:
    if not body.get("supplier") or not body.get("model"):
        raise BizError("供应商和设备型号为必填项")
    if not body.get("imei") or not body.get("mac"):
        raise BizError("IMEI 和 MAC 为必填项")
    qty = int(body.get("qty") or 1)
    item = {
        "id": _next_id(store.stock_in),
        "inNo": _gen_in_no(store.stock_in),
        "inDate": _normalize_datetime(body.get("inDate")),
        "supplier": body.get("supplier", ""),
        "model": body.get("model", ""),
        "imei": body.get("imei", ""),
        "mac": body.get("mac", ""),
        "qty": qty,
        "stockQty": qty,
        "receiver": body.get("receiver", ""),
        "remark": body.get("remark", ""),
    }
    store.stock_in.insert(0, item)
    return item


def update_stock_in(body: dict) -> dict:
    item = next((s for s in store.stock_in if s["id"] == body.get("id")), None)
    if not item:
        raise BizError("入库记录不存在")
    new_qty = int(body.get("qty") or item.get("qty") or 1)
    updated = {
        **item,
        **body,
        "qty": new_qty,
        "stockQty": (item.get("stockQty") or 0) + (new_qty - (item.get("qty") or 0)),
    }
    store.stock_in = [updated if s["id"] == item["id"] else s for s in store.stock_in]
    return updated


def delete_stock_in(record_id: int) -> bool:
    before = len(store.stock_in)
    store.stock_in = [s for s in store.stock_in if s["id"] != record_id]
    if len(store.stock_in) == before:
        raise BizError("入库记录不存在")
    return True


def import_stock_in(rows: list) -> dict:
    validated = _validate_import_rows(StockInImportRow, rows)
    new_items = []
    for row in validated:
        qty = int(row.get("qty") or 1)
        item = {
            "id": _next_id(store.stock_in + new_items),
            "inNo": _gen_in_no(store.stock_in + new_items),
            "inDate": _normalize_datetime(row.get("inDate")),
            "supplier": row.get("supplier", ""),
            "model": row.get("model", ""),
            "imei": row.get("imei", ""),
            "mac": row.get("mac", ""),
            "qty": qty,
            "stockQty": qty,
            "receiver": row.get("receiver", ""),
            "remark": row.get("remark", ""),
        }
        new_items.append(item)
    store.stock_in = new_items + store.stock_in
    return {"count": len(new_items), "list": new_items}


def list_sim_stock_in(
    keyword: str = "",
    operator: str = "",
    low_stock: bool = False,
    start_date: str = "",
    end_date: str = "",
) -> dict:
    items = _filter_list(
        store.sim_stock_in,
        keyword=keyword,
        operator=operator,
        low_stock=low_stock,
        start_date=start_date,
        end_date=end_date,
        keyword_fields=_SIM_KEYWORD_FIELDS,
    )
    return {"list": items, "total": len(items)}


def create_sim_stock_in(body: dict) -> dict:
    if not body.get("operator") or not body.get("iccid"):
        raise BizError("运营商和 ICCID 为必填项")
    if body.get("operator") not in _OPERATORS:
        raise BizError("运营商无效")
    qty = int(body.get("qty") or 1)
    item = {
        "id": _next_id(store.sim_stock_in),
        "inNo": _gen_in_no(store.sim_stock_in),
        "inDate": _normalize_datetime(body.get("inDate")),
        "supplier": body.get("supplier", ""),
        "operator": body.get("operator", ""),
        "iccid": body.get("iccid", ""),
        "qty": qty,
        "stockQty": qty,
        "receiver": body.get("receiver", ""),
        "remark": body.get("remark", ""),
    }
    store.sim_stock_in.insert(0, item)
    return item


def update_sim_stock_in(body: dict) -> dict:
    item = next((s for s in store.sim_stock_in if s["id"] == body.get("id")), None)
    if not item:
        raise BizError("入库记录不存在")
    if body.get("operator") and body["operator"] not in _OPERATORS:
        raise BizError("运营商无效")
    new_qty = int(body.get("qty") or item.get("qty") or 1)
    updated = {
        **item,
        **body,
        "qty": new_qty,
        "stockQty": (item.get("stockQty") or 0) + (new_qty - (item.get("qty") or 0)),
    }
    store.sim_stock_in = [updated if s["id"] == item["id"] else s for s in store.sim_stock_in]
    return updated


def delete_sim_stock_in(record_id: int) -> bool:
    before = len(store.sim_stock_in)
    store.sim_stock_in = [s for s in store.sim_stock_in if s["id"] != record_id]
    if len(store.sim_stock_in) == before:
        raise BizError("入库记录不存在")
    return True


def import_sim_stock_in(rows: list) -> dict:
    validated = _validate_import_rows(SimStockInImportRow, rows)
    new_items = []
    for row in validated:
        qty = int(row.get("qty") or 1)
        item = {
            "id": _next_id(store.sim_stock_in + new_items),
            "inNo": _gen_in_no(store.sim_stock_in + new_items),
            "inDate": _normalize_datetime(row.get("inDate")),
            "supplier": row.get("supplier", ""),
            "operator": row.get("operator", ""),
            "iccid": row.get("iccid", ""),
            "qty": qty,
            "stockQty": qty,
            "receiver": row.get("receiver", ""),
            "remark": row.get("remark", ""),
        }
        new_items.append(item)
    store.sim_stock_in = new_items + store.sim_stock_in
    return {"count": len(new_items), "list": new_items}


def list_stock_out(
    keyword: str = "",
    operator: str = "",
    start_date: str = "",
    end_date: str = "",
) -> dict:
    items = _filter_list(
        store.stock_out,
        keyword=keyword,
        operator=operator,
        start_date=start_date,
        end_date=end_date,
        date_field="outDate",
        keyword_fields=_OUT_KEYWORD_FIELDS,
    )
    return {"list": items, "total": len(items)}


def _deduct_device_stock(mac: str) -> None:
    if not mac:
        return
    for item in store.stock_in:
        if item.get("mac") == mac and (item.get("stockQty") or 0) > 0:
            item["stockQty"] -= 1
            return


def _deduct_sim_stock(iccid: str) -> None:
    if not iccid:
        return
    for item in store.sim_stock_in:
        if item.get("iccid") == iccid and (item.get("stockQty") or 0) > 0:
            item["stockQty"] -= 1
            return


def _validate_out_fields(body: dict) -> None:
    operator = body.get("operator", "")
    if operator and operator not in _OPERATORS:
        raise BizError("运营商无效")
    iccid = (body.get("iccid") or "").strip()
    iccid2 = (body.get("iccid2") or "").strip()
    if iccid and iccid2 and iccid == iccid2:
        raise BizError("ICCID2 不能与 ICCID 相同")


def _build_stock_out_item(body: dict, db: Session | None = None, existing_items: list | None = None) -> dict:
    _validate_out_fields(body)
    if not body.get("orderNo") or not body.get("model") or not body.get("mac"):
        raise BizError("工单号、设备型号和 MAC 为必填项")
    order = _find_work_order(db, body["orderNo"])
    pool = existing_items if existing_items is not None else store.stock_out
    return {
        "id": _next_id(pool),
        "outNo": _gen_out_no(pool),
        "outDate": _normalize_datetime(body.get("outDate")),
        "orderNo": body.get("orderNo", ""),
        "storeName": body.get("storeName") or (order.get("storeName") if order else ""),
        "customerName": body.get("customerName") or (order.get("customerName") if order else ""),
        "address": body.get("address") or (order.get("address") if order else ""),
        "model": body.get("model", ""),
        "imei": body.get("imei", ""),
        "mac": body.get("mac", ""),
        "iccid": (body.get("iccid") or "").strip(),
        "iccid2": (body.get("iccid2") or "").strip(),
        "operator": body.get("operator", ""),
        "receiver": body.get("receiver", ""),
        "remark": body.get("remark", ""),
    }


def _apply_out_deduction(item: dict) -> None:
    _deduct_device_stock(item["mac"])
    _deduct_sim_stock(item.get("iccid"))
    _deduct_sim_stock(item.get("iccid2"))


def create_stock_out(body: dict, db: Session | None = None) -> dict:
    item = _build_stock_out_item(body, db=db)
    _apply_out_deduction(item)
    store.stock_out.insert(0, item)
    return item


def import_stock_out(rows: list, db: Session | None = None) -> dict:
    validated = _validate_import_rows(StockOutImportRow, rows)
    new_items = []
    for row in validated:
        item = _build_stock_out_item(row, db=db, existing_items=store.stock_out + new_items)
        _apply_out_deduction(item)
        new_items.append(item)
    store.stock_out = new_items + store.stock_out
    return {"count": len(new_items), "list": new_items}
