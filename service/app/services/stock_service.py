from datetime import date, datetime

from sqlalchemy.orm import Session

from pydantic import ValidationError

from app.core.exceptions import BizError
from app.db.models import SimStockIn, StockIn, StockOut
from app.services import work_order_service as work_order_svc
from app.schemas.stock import (
    SimStockInImportRow,
    StockInImportRow,
    StockOutImportRow,
)

_OPERATORS = {"中国移动", "中国电信", "中国联通"}

_CARD_FIELDS = ("mobileNo", "telecomNo", "replacedCardNo")
_OUT_KEYWORD_FIELDS = (
    "outNo", "orderNo", "storeName", "customerName", "model",
    "imei", "mac", "iccid", "iccid2", "receiver", "remark",
    *_CARD_FIELDS,
)
_IN_KEYWORD_FIELDS = (
    "inNo", "supplier", "model", "imei", "mac", "receiver", "remark",
    "storeName", "orderNo", *_CARD_FIELDS,
)
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


def _in_to_dict(r: StockIn) -> dict:
    return {
        "id": r.id, "inNo": r.in_no, "inDate": r.in_date, "supplier": r.supplier,
        "model": r.model, "imei": r.imei, "mac": r.mac, "qty": r.qty,
        "stockQty": r.stock_qty, "receiver": r.receiver, "remark": r.remark,
        "storeName": r.store_name, "orderNo": r.order_no,
        "mobileNo": r.mobile_no, "telecomNo": r.telecom_no,
        "replacedCardNo": r.replaced_card_no,
    }


def _sim_to_dict(r: SimStockIn) -> dict:
    return {
        "id": r.id, "inNo": r.in_no, "inDate": r.in_date, "supplier": r.supplier,
        "operator": r.operator, "iccid": r.iccid, "qty": r.qty,
        "stockQty": r.stock_qty, "receiver": r.receiver, "remark": r.remark,
    }


def _out_to_dict(r: StockOut) -> dict:
    return {
        "id": r.id, "outNo": r.out_no, "outDate": r.out_date, "orderNo": r.order_no,
        "storeName": r.store_name, "customerName": r.customer_name, "address": r.address,
        "model": r.model, "imei": r.imei, "mac": r.mac, "iccid": r.iccid,
        "iccid2": r.iccid2, "operator": r.operator, "receiver": r.receiver, "remark": r.remark,
        "mobileNo": r.mobile_no, "telecomNo": r.telecom_no,
        "replacedCardNo": r.replaced_card_no,
    }


def _gen_in_no(db: Session) -> str:
    d = date.today().strftime("%Y%m%d")
    prefix = f"RK{d}"
    seq = (
        db.query(StockIn).filter(StockIn.in_no.like(f"{prefix}%")).count()
        + db.query(SimStockIn).filter(SimStockIn.in_no.like(f"{prefix}%")).count()
        + 1
    )
    return f"{prefix}{seq:03d}"


def _gen_out_no(db: Session) -> str:
    d = date.today().strftime("%Y%m%d")
    prefix = f"CK{d}"
    seq = db.query(StockOut).filter(StockOut.out_no.like(f"{prefix}%")).count() + 1
    return f"{prefix}{seq:03d}"


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
    low_threshold: int = 5,
    start_date: str = "",
    end_date: str = "",
    date_field: str = "inDate",
    keyword_fields: tuple[str, ...] = _IN_KEYWORD_FIELDS,
    store_name: str = "",
    order_no: str = "",
) -> list:
    result = items
    if operator:
        result = [r for r in result if r.get("operator") == operator]
    if supplier:
        result = [r for r in result if r.get("supplier") == supplier]
    if store_name:
        result = [r for r in result if r.get("storeName") == store_name]
    if order_no:
        result = [r for r in result if r.get("orderNo") == order_no]
    if low_stock:
        result = [r for r in result if (r.get("stockQty") or 0) <= low_threshold]
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


def _check_card_pair(body: dict) -> None:
    mobile = (body.get("mobileNo") or "").strip()
    telecom = (body.get("telecomNo") or "").strip()
    if mobile and telecom and mobile == telecom:
        raise BizError("移动卡号与电信卡号不能相同")


def _card_kwargs(body: dict) -> dict:
    return {
        "mobile_no": (body.get("mobileNo") or "").strip(),
        "telecom_no": (body.get("telecomNo") or "").strip(),
        "replaced_card_no": (body.get("replacedCardNo") or "").strip(),
    }


def list_stock_in(
    db: Session,
    keyword: str = "",
    supplier: str = "",
    low_stock: bool = False,
    start_date: str = "",
    end_date: str = "",
    low_threshold: int = 5,
    store_name: str = "",
    order_no: str = "",
) -> dict:
    rows = db.query(StockIn).order_by(StockIn.id.desc()).all()
    items = _filter_list(
        [_in_to_dict(r) for r in rows],
        keyword=keyword,
        supplier=supplier,
        low_stock=low_stock,
        low_threshold=low_threshold,
        start_date=start_date,
        end_date=end_date,
        keyword_fields=_IN_KEYWORD_FIELDS,
        store_name=store_name,
        order_no=order_no,
    )
    return {"list": items, "total": len(items), "lowThreshold": low_threshold}


def create_stock_in(db: Session, body: dict) -> dict:
    if not body.get("supplier") or not body.get("model"):
        raise BizError("供应商和设备型号为必填项")
    if not body.get("imei") or not body.get("mac"):
        raise BizError("IMEI 和 MAC 为必填项")
    _check_card_pair(body)
    qty = int(body.get("qty") or 1)
    row = StockIn(
        in_no=_gen_in_no(db),
        in_date=_normalize_datetime(body.get("inDate")),
        supplier=body.get("supplier", ""),
        model=body.get("model", ""),
        imei=body.get("imei", ""),
        mac=body.get("mac", ""),
        qty=qty,
        stock_qty=qty,
        receiver=body.get("receiver", ""),
        remark=body.get("remark", ""),
        store_name=(body.get("storeName") or "").strip(),
        order_no=(body.get("orderNo") or "").strip(),
        **_card_kwargs(body),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _in_to_dict(row)


_IN_PATCH_FIELDS = {
    "inDate": "in_date", "supplier": "supplier", "model": "model",
    "imei": "imei", "mac": "mac", "receiver": "receiver", "remark": "remark",
    "storeName": "store_name", "orderNo": "order_no",
    "mobileNo": "mobile_no", "telecomNo": "telecom_no",
    "replacedCardNo": "replaced_card_no",
}


def update_stock_in(db: Session, body: dict) -> dict:
    row = db.query(StockIn).filter(StockIn.id == body.get("id")).first()
    if not row:
        raise BizError("入库记录不存在")
    _check_card_pair({
        "mobileNo": body.get("mobileNo", row.mobile_no),
        "telecomNo": body.get("telecomNo", row.telecom_no),
    })
    for api_key, attr in _IN_PATCH_FIELDS.items():
        if api_key in body and body[api_key] is not None:
            value = body[api_key]
            if isinstance(value, str):
                value = value.strip()
            setattr(row, attr, value)
    new_qty = int(body.get("qty") or row.qty or 1)
    row.stock_qty = (row.stock_qty or 0) + (new_qty - (row.qty or 0))
    row.qty = new_qty
    db.commit()
    db.refresh(row)
    return _in_to_dict(row)


def delete_stock_in(db: Session, record_id: int) -> bool:
    row = db.query(StockIn).filter(StockIn.id == record_id).first()
    if not row:
        raise BizError("入库记录不存在")
    db.delete(row)
    db.commit()
    return True


def import_stock_in(db: Session, rows: list) -> dict:
    validated = _validate_import_rows(StockInImportRow, rows)
    new_rows = []
    for row in validated:
        _check_card_pair(row)
        qty = int(row.get("qty") or 1)
        item = StockIn(
            in_no=_gen_in_no(db),
            in_date=_normalize_datetime(row.get("inDate")),
            supplier=row.get("supplier", ""),
            model=row.get("model", ""),
            imei=row.get("imei", ""),
            mac=row.get("mac", ""),
            qty=qty,
            stock_qty=qty,
            receiver=row.get("receiver", ""),
            remark=row.get("remark", ""),
            store_name=(row.get("storeName") or "").strip(),
            order_no=(row.get("orderNo") or "").strip(),
            **_card_kwargs(row),
        )
        db.add(item)
        db.flush()
        new_rows.append(item)
    db.commit()
    items = [_in_to_dict(r) for r in new_rows]
    return {"count": len(items), "list": items}


def list_sim_stock_in(
    db: Session,
    keyword: str = "",
    operator: str = "",
    low_stock: bool = False,
    start_date: str = "",
    end_date: str = "",
    low_threshold: int = 5,
) -> dict:
    rows = db.query(SimStockIn).order_by(SimStockIn.id.desc()).all()
    items = _filter_list(
        [_sim_to_dict(r) for r in rows],
        keyword=keyword,
        operator=operator,
        low_stock=low_stock,
        low_threshold=low_threshold,
        start_date=start_date,
        end_date=end_date,
        keyword_fields=_SIM_KEYWORD_FIELDS,
    )
    return {"list": items, "total": len(items), "lowThreshold": low_threshold}


def create_sim_stock_in(db: Session, body: dict) -> dict:
    if not body.get("operator") or not body.get("iccid"):
        raise BizError("运营商和 ICCID 为必填项")
    if body.get("operator") not in _OPERATORS:
        raise BizError("运营商无效")
    qty = int(body.get("qty") or 1)
    row = SimStockIn(
        in_no=_gen_in_no(db),
        in_date=_normalize_datetime(body.get("inDate")),
        supplier=body.get("supplier", ""),
        operator=body.get("operator", ""),
        iccid=body.get("iccid", ""),
        qty=qty,
        stock_qty=qty,
        receiver=body.get("receiver", ""),
        remark=body.get("remark", ""),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _sim_to_dict(row)


_SIM_PATCH_FIELDS = {
    "inDate": "in_date", "supplier": "supplier", "operator": "operator",
    "iccid": "iccid", "receiver": "receiver", "remark": "remark",
}


def update_sim_stock_in(db: Session, body: dict) -> dict:
    row = db.query(SimStockIn).filter(SimStockIn.id == body.get("id")).first()
    if not row:
        raise BizError("入库记录不存在")
    if body.get("operator") and body["operator"] not in _OPERATORS:
        raise BizError("运营商无效")
    for api_key, attr in _SIM_PATCH_FIELDS.items():
        if api_key in body and body[api_key] is not None:
            setattr(row, attr, body[api_key])
    new_qty = int(body.get("qty") or row.qty or 1)
    row.stock_qty = (row.stock_qty or 0) + (new_qty - (row.qty or 0))
    row.qty = new_qty
    db.commit()
    db.refresh(row)
    return _sim_to_dict(row)


def delete_sim_stock_in(db: Session, record_id: int) -> bool:
    row = db.query(SimStockIn).filter(SimStockIn.id == record_id).first()
    if not row:
        raise BizError("入库记录不存在")
    db.delete(row)
    db.commit()
    return True


def import_sim_stock_in(db: Session, rows: list) -> dict:
    validated = _validate_import_rows(SimStockInImportRow, rows)
    new_rows = []
    for row in validated:
        qty = int(row.get("qty") or 1)
        item = SimStockIn(
            in_no=_gen_in_no(db),
            in_date=_normalize_datetime(row.get("inDate")),
            supplier=row.get("supplier", ""),
            operator=row.get("operator", ""),
            iccid=row.get("iccid", ""),
            qty=qty,
            stock_qty=qty,
            receiver=row.get("receiver", ""),
            remark=row.get("remark", ""),
        )
        db.add(item)
        db.flush()
        new_rows.append(item)
    db.commit()
    items = [_sim_to_dict(r) for r in new_rows]
    return {"count": len(items), "list": items}


def list_stock_out(
    db: Session,
    keyword: str = "",
    operator: str = "",
    start_date: str = "",
    end_date: str = "",
    store_name: str = "",
    order_no: str = "",
) -> dict:
    rows = db.query(StockOut).order_by(StockOut.id.desc()).all()
    items = _filter_list(
        [_out_to_dict(r) for r in rows],
        keyword=keyword,
        operator=operator,
        start_date=start_date,
        end_date=end_date,
        date_field="outDate",
        keyword_fields=_OUT_KEYWORD_FIELDS,
        store_name=store_name,
        order_no=order_no,
    )
    return {"list": items, "total": len(items)}


def _deduct_device_stock(db: Session, mac: str) -> None:
    if not mac:
        return
    row = (
        db.query(StockIn)
        .filter(StockIn.mac == mac, StockIn.stock_qty > 0)
        .first()
    )
    if row:
        row.stock_qty -= 1


def _deduct_sim_stock(db: Session, iccid: str) -> None:
    if not iccid:
        return
    row = (
        db.query(SimStockIn)
        .filter(SimStockIn.iccid == iccid, SimStockIn.stock_qty > 0)
        .first()
    )
    if row:
        row.stock_qty -= 1


def _validate_out_fields(body: dict) -> None:
    operator = body.get("operator", "")
    if operator and operator not in _OPERATORS:
        raise BizError("运营商无效")
    iccid = (body.get("iccid") or "").strip()
    iccid2 = (body.get("iccid2") or "").strip()
    if iccid and iccid2 and iccid == iccid2:
        raise BizError("ICCID2 不能与 ICCID 相同")


def _build_stock_out_row(db: Session, body: dict) -> StockOut:
    _validate_out_fields(body)
    _check_card_pair(body)
    if not body.get("orderNo") or not body.get("model") or not body.get("mac"):
        raise BizError("工单号、设备型号和 MAC 为必填项")
    order = work_order_svc.find_work_order_by_order_no(db, body["orderNo"])
    return StockOut(
        out_no=_gen_out_no(db),
        out_date=_normalize_datetime(body.get("outDate")),
        order_no=body.get("orderNo", ""),
        store_name=(body.get("storeName") or "").strip() or (order.get("storeName") if order else ""),
        customer_name=body.get("customerName") or (order.get("customerName") if order else ""),
        address=body.get("address") or (order.get("address") if order else ""),
        model=body.get("model", ""),
        imei=body.get("imei", ""),
        mac=body.get("mac", ""),
        iccid=(body.get("iccid") or "").strip(),
        iccid2=(body.get("iccid2") or "").strip(),
        operator=body.get("operator", ""),
        receiver=body.get("receiver", ""),
        remark=body.get("remark", ""),
        **_card_kwargs(body),
    )


def _apply_out_deduction(db: Session, row: StockOut) -> None:
    _deduct_device_stock(db, row.mac)
    _deduct_sim_stock(db, row.iccid)
    _deduct_sim_stock(db, row.iccid2)


def create_stock_out(db: Session, body: dict) -> dict:
    row = _build_stock_out_row(db, body)
    db.add(row)
    _apply_out_deduction(db, row)
    db.commit()
    db.refresh(row)
    return _out_to_dict(row)


def import_stock_out(db: Session, rows: list) -> dict:
    validated = _validate_import_rows(StockOutImportRow, rows)
    new_rows = []
    for raw in validated:
        row = _build_stock_out_row(db, raw)
        db.add(row)
        db.flush()
        _apply_out_deduction(db, row)
        new_rows.append(row)
    db.commit()
    items = [_out_to_dict(r) for r in new_rows]
    return {"count": len(items), "list": items}
