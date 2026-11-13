from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import Contract, Customer, User
from app.services.contract_doc import NET_TEMPLATE, docx_to_html, prepare_net_contract, render_contract_docx
from app.services.upload_service import get_upload_root
from app.utils.contract_status import resolve_contract_status


def contract_to_dict(row: Contract) -> dict:
    return {
        "id": row.id,
        "contractNo": row.contract_no,
        "templateKey": row.template_key or "",
        "orderNo": row.order_no,
        "customerName": row.customer_name,
        "signerName": row.signer_name or "",
        "signerPhone": row.signer_phone or "",
        "signerIdNo": row.signer_id_no or "",
        "signDate": row.sign_date or "",
        "storeName": row.store_name,
        "package": row.package,
        "amount": row.amount,
        "startDate": row.start_date,
        "endDate": row.end_date,
        "status": resolve_contract_status(row.end_date, row.status),
        "cityCode": row.city_code,
        "salesName": row.sales_name,
        **_net_view(row),
    }


def _net_view(row: Contract) -> dict:
    extra = row.form_data if isinstance(row.form_data, dict) else {}
    lines = extra.get("orderLines") or []
    summary = "；".join(
        "/".join(str(item.get(key) or "") for key in ("mallName", "deviceType", "deviceModel", "unitPrice", "contractDate"))
        for item in lines
    )
    return {
        "salesPhone": extra.get("salesPhone") or "",
        "productType": extra.get("productType") or "",
        "deviceAmount": extra.get("deviceAmount") or 0,
        "deviceAmountUpper": extra.get("deviceAmountUpper") or "",
        "partyAddress": extra.get("partyAddress") or "",
        "partyBank": extra.get("partyBank") or "",
        "partyAccount": extra.get("partyAccount") or "",
        "agentName": extra.get("agentName") or "",
        "agentIdNo": extra.get("agentIdNo") or "",
        "agentTitle": extra.get("agentTitle") or "",
        "agentPhone": extra.get("agentPhone") or "",
        "agentEmail": extra.get("agentEmail") or "",
        "agentAddress": extra.get("agentAddress") or "",
        "partnerName": extra.get("partnerName") or "",
        "partnerIdNo": extra.get("partnerIdNo") or "",
        "partnerPhone": extra.get("partnerPhone") or "",
        "partnerSignDate": extra.get("partnerSignDate") or "",
        "orderLines": lines,
        "orderTotal": extra.get("orderTotal") if extra.get("orderTotal") is not None else row.amount,
        "orderSummary": summary,
        "docPath": row.doc_path or "",
        "docName": row.doc_name or "",
    }


def _gen_contract_no(db: Session, city_code: str = "SH") -> str:
    d = date.today().strftime("%Y%m%d")
    prefix = f"{city_code}{d}"
    seq = db.query(Contract).filter(Contract.contract_no.like(f"{prefix}%")).count() + 1
    return f"{prefix}{seq:03d}"


def _resolve_status(start_date: str, end_date: str, status: str) -> str:
    return resolve_contract_status(end_date, status)


def _resolve_sales_name(db: Session, body: dict) -> str:
    if body.get("salesName"):
        return body["salesName"]
    order_no = body.get("orderNo", "")
    if order_no:
        customer = db.query(Customer).filter(Customer.order_no == order_no).first()
        if customer:
            return customer.sales_name or ""
    return ""


def _build_contract_row(db: Session, body: dict) -> Contract:
    city = body.get("cityCode") or "SH"
    contract_no = body.get("contractNo") or _gen_contract_no(db, city)
    status = _resolve_status(
        body.get("startDate", ""),
        body.get("endDate", ""),
        body.get("status", "待生成"),
    )
    return Contract(
        contract_no=contract_no,
        template_key=body.get("templateKey") or "",
        order_no=body.get("orderNo", ""),
        customer_name=body.get("customerName", ""),
        signer_name=body.get("signerName", ""),
        signer_phone=body.get("signerPhone", ""),
        signer_id_no=body.get("signerIdNo", ""),
        sign_date=body.get("signDate", ""),
        store_name=body.get("storeName", ""),
        package=body.get("package", ""),
        amount=float(body.get("amount") or 0),
        start_date=body.get("startDate", ""),
        end_date=body.get("endDate", ""),
        status=status,
        city_code=city,
        sales_name=_resolve_sales_name(db, body),
    )


def _like(value: str) -> str:
    return f"%{value.strip()}%"


def _apply_text(q, column, value: str):
    text = (value or "").strip()
    if not text:
        return q
    return q.filter(column.like(_like(text)))


def _apply_date_range(q, column, start: str, end: str):
    start = (start or "").strip()[:10]
    end = (end or "").strip()[:10]
    if start:
        q = q.filter(column >= start)
    if end:
        q = q.filter(column != "", column <= end)
    return q


def list_contracts(
    db: Session,
    keyword: str = "",
    status: str = "",
    order_no: str = "",
    sales_names: list[str] | None = None,
    template_key: str = "",
    store_name: str = "",
    sales_name: str = "",
    city_code: str = "",
    package: str = "",
    sign_date_from: str = "",
    sign_date_to: str = "",
    end_date_from: str = "",
    end_date_to: str = "",
) -> dict:
    q = db.query(Contract)
    scoped = sales_names is not None
    if scoped:
        if not sales_names:
            return {"list": [], "total": 0}
        sales_name = ""
    if order_no:
        q = q.filter(Contract.order_no == order_no)
    if (template_key or "").strip():
        q = q.filter(Contract.template_key == template_key.strip())
    q = _apply_text(q, Contract.store_name, store_name)
    q = _apply_text(q, Contract.sales_name, sales_name)
    q = _apply_text(q, Contract.city_code, city_code)
    q = _apply_text(q, Contract.package, package)
    q = _apply_date_range(q, Contract.sign_date, sign_date_from, sign_date_to)
    q = _apply_date_range(q, Contract.end_date, end_date_from, end_date_to)
    if keyword:
        kw = _like(keyword)
        q = q.filter(
            Contract.contract_no.like(kw)
            | Contract.customer_name.like(kw)
            | Contract.order_no.like(kw)
            | Contract.signer_name.like(kw)
            | Contract.signer_phone.like(kw)
            | Contract.store_name.like(kw)
        )
    rows = q.order_by(Contract.id).all()
    if scoped:
        from app.services.customer_owner import OwnerIndex

        index = OwnerIndex.load(db)
        allowed = set(sales_names or [])
        rows = [
            row for row in rows
            if OwnerIndex.visible(
                index.find(order_no=row.order_no, store=row.store_name, customer_name=row.customer_name),
                row.sales_name,
                allowed,
            )
        ]
    items = [contract_to_dict(r) for r in rows]
    if status:
        items = [i for i in items if i.get("status") == status]
    return {"list": items, "total": len(items)}


def create_contract(db: Session, body: dict) -> dict:
    order_no = body.get("orderNo", "")
    if order_no and db.query(Contract).filter(Contract.order_no == order_no).first():
        raise BizError(f"工单 {order_no} 已存在合同")
    prepared = _prepare_if_net(body)
    row = _build_contract_row(db, _overlay(body, prepared))
    if prepared:
        row.form_data = prepared
        if (body.get("status") or "待生成") == "待生成":
            row.status = "正常"
    db.add(row)
    db.flush()
    if prepared:
        _write_contract_file(row, prepared)
    db.commit()
    db.refresh(row)
    return contract_to_dict(row)


def update_contract(db: Session, body: dict) -> dict:
    row = db.query(Contract).filter(Contract.id == body["id"]).first()
    if not row:
        raise BizError("合同不存在")
    order_no = (body.get("orderNo") or "").strip()
    if order_no:
        other = db.query(Contract).filter(Contract.order_no == order_no, Contract.id != row.id).first()
        if other:
            raise BizError(f"工单 {order_no} 已存在合同")
    row.template_key = body.get("templateKey") or ""
    row.order_no = order_no
    row.customer_name = body.get("customerName", "")
    row.signer_name = body.get("signerName", "")
    row.signer_phone = body.get("signerPhone", "")
    row.signer_id_no = body.get("signerIdNo", "")
    row.sign_date = body.get("signDate", "")
    row.store_name = body.get("storeName", "")
    row.package = body.get("package", "")
    row.amount = float(body.get("amount") or 0)
    row.start_date = body.get("startDate", "")
    row.end_date = body.get("endDate", "")
    row.city_code = body.get("cityCode") or "SH"
    row.status = _resolve_status(row.start_date, row.end_date, body.get("status", "正常"))
    prepared = _prepare_if_net(body)
    if prepared:
        row.sign_date = prepared["signDate"]
        row.start_date = prepared["startDate"]
        row.end_date = prepared["endDate"]
        row.store_name = prepared["storeName"]
        row.customer_name = prepared["customerName"]
        row.signer_name = prepared["signerName"]
        row.signer_phone = prepared["signerPhone"]
        row.signer_id_no = prepared["signerIdNo"]
        row.package = prepared["productType"]
        row.amount = float(prepared["orderTotal"])
        row.sales_name = prepared["salesName"]
        row.form_data = prepared
        if row.status == "待生成":
            row.status = "正常"
        _write_contract_file(row, prepared)
    elif row.doc_path:
        _clear_contract_file(row)
    db.commit()
    db.refresh(row)
    return contract_to_dict(row)


def _prepare_if_net(body: dict) -> dict | None:
    if (body.get("templateKey") or "") != NET_TEMPLATE:
        return None
    return prepare_net_contract(body)


def _overlay(body: dict, prepared: dict | None) -> dict:
    if not prepared:
        return body
    merged = dict(body)
    for key in (
        "signDate", "startDate", "endDate", "storeName", "customerName", "signerName",
        "signerPhone", "signerIdNo", "salesName",
    ):
        merged[key] = prepared[key]
    merged["package"] = prepared["productType"]
    merged["amount"] = prepared["orderTotal"]
    return merged


def _contract_root() -> Path:
    """合同含身份证号，不放进对外静态目录 /api/files。"""
    root = (get_upload_root().parent / "contract_files").resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _write_contract_file(row: Contract, prepared: dict) -> None:
    store = prepared["storeName"].replace("/", "／").replace("\\", "")
    filename = f"网络服务合同-{store}-{row.contract_no}.docx"
    dest = _contract_root() / f"{row.id}.docx"
    render_contract_docx(prepared, dest)
    row.doc_path = dest.name
    row.doc_name = filename


def _clear_contract_file(row: Contract) -> None:
    name = Path(row.doc_path or "").name
    if name:
        path = (_contract_root() / name).resolve()
        if path.is_relative_to(_contract_root()) and path.is_file():
            path.unlink()
    row.doc_path = ""
    row.doc_name = ""


def contract_abs_path(row: Contract) -> Path:
    name = Path(row.doc_path or "").name
    if not name:
        raise BizError("该合同还没有生成文件")
    root = _contract_root()
    path = (root / name).resolve()
    if not path.is_relative_to(root):
        raise BizError("合同文件路径无效")
    if not path.is_file():
        raise BizError("合同文件不存在")
    return path


def contract_preview_html(row: Contract) -> dict:
    path = contract_abs_path(row)
    return {"html": docx_to_html(path), "filename": row.doc_name or path.name}


def list_fill_sources(db: Session, sales_names: list[str] | None) -> dict:
    q = db.query(Customer).filter(Customer.owner_status != "pending")
    if sales_names is not None:
        if not sales_names:
            customers = []
        else:
            customers = q.filter(Customer.sales_name.in_(sales_names)).order_by(Customer.id.desc()).all()
    else:
        customers = q.order_by(Customer.id.desc()).all()
    user_q = db.query(User).filter(User.enabled.is_(True))
    if sales_names is not None:
        user_q = user_q.filter(User.name.in_(sales_names or ["__none__"]))
    else:
        user_q = user_q.filter(User.role_code == "sales")
    sales = [
        {"name": row.name, "phone": row.phone or ""}
        for row in user_q.order_by(User.id).all()
        if (row.name or "").strip()
    ]
    return {
        "customers": [
            {
                "id": row.id,
                "storeName": row.store_name,
                "customerName": row.customer_name,
                "contact": row.contact,
                "phone": row.phone,
                "address": row.address,
                "salesName": row.sales_name,
                "orderNo": row.order_no,
                "deviceModel": row.device_model,
                "price": row.price,
            }
            for row in customers
        ],
        "sales": sales,
    }


def import_contracts(db: Session, rows: list[dict]) -> dict:
    new_rows = []
    for raw in rows:
        order_no = raw.get("orderNo", "")
        if order_no and db.query(Contract).filter(Contract.order_no == order_no).first():
            continue
        row = _build_contract_row(db, raw)
        db.add(row)
        db.flush()
        new_rows.append(row)
    db.commit()
    items = [contract_to_dict(r) for r in new_rows]
    return {"count": len(items), "list": items}


def activate_contract(db: Session, row: Contract) -> None:
    if (row.contract_no or "").startswith("待") or not row.contract_no:
        row.contract_no = _gen_contract_no(db, row.city_code or "SH")
    row.status = "正常"


def generate_contract(db: Session, order_no: str) -> dict:
    row = db.query(Contract).filter(Contract.order_no == order_no).first()
    if not row:
        raise BizError("合同不存在")
    if row.status != "待生成":
        raise BizError("该合同已生成")
    activate_contract(db, row)
    db.commit()
    db.refresh(row)
    return contract_to_dict(row)
