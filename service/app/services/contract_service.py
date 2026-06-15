from datetime import date, timedelta

from app.core.exceptions import BizError
from app.data.store import store


def _next_contract_id() -> int:
    store.contract_seq += 1
    return store.contract_seq


def _gen_contract_no(city_code: str = "SH") -> str:
    d = date.today().strftime("%Y%m%d")
    seq = len(store.contracts) + 1
    return f"{city_code}{d}{seq:03d}"


def _resolve_status(start_date: str, end_date: str, status: str) -> str:
    if status == "待生成":
        return status
    try:
        end = date.fromisoformat(end_date[:10])
        if end <= date.today() + timedelta(days=30):
            return "即将到期"
    except ValueError:
        pass
    return status or "正常"


def _build_contract(body: dict, contract_id: int | None = None) -> dict:
    city = body.get("cityCode") or "SH"
    contract_no = body.get("contractNo") or _gen_contract_no(city)
    status = _resolve_status(
        body.get("startDate", ""),
        body.get("endDate", ""),
        body.get("status", "待生成"),
    )
    return {
        "id": contract_id or _next_contract_id(),
        "contractNo": contract_no,
        "orderNo": body.get("orderNo", ""),
        "customerName": body.get("customerName", ""),
        "storeName": body.get("storeName", ""),
        "package": body.get("package", ""),
        "amount": float(body.get("amount") or 0),
        "startDate": body.get("startDate", ""),
        "endDate": body.get("endDate", ""),
        "status": status,
        "cityCode": city,
    }


def list_contracts(keyword: str = "", status: str = "", order_no: str = "") -> dict:
    items = list(store.contracts)
    if order_no:
        items = [c for c in items if c.get("orderNo") == order_no]
    if status:
        items = [c for c in items if c.get("status") == status]
    if keyword:
        kw = keyword.strip()
        items = [
            c for c in items
            if kw in c.get("contractNo", "")
            or kw in c.get("customerName", "")
            or kw in c.get("orderNo", "")
        ]
    return {"list": items, "total": len(items)}


def create_contract(body: dict) -> dict:
    order_no = body.get("orderNo", "")
    if any(c.get("orderNo") == order_no for c in store.contracts):
        raise BizError(f"工单 {order_no} 已存在合同")
    item = _build_contract(body)
    store.contracts.append(item)
    return item


def import_contracts(rows: list[dict]) -> dict:
    new_items = []
    for row in rows:
        order_no = row.get("orderNo", "")
        if any(c.get("orderNo") == order_no for c in store.contracts):
            continue
        item = _build_contract(row)
        store.contracts.append(item)
        new_items.append(item)
    return {"count": len(new_items), "list": new_items}


def generate_contract(order_no: str) -> dict:
    idx = next((i for i, c in enumerate(store.contracts) if c.get("orderNo") == order_no), None)
    if idx is None:
        raise BizError("合同不存在")
    item = store.contracts[idx]
    if item.get("status") != "待生成":
        raise BizError("该合同已生成")
    contract_no = item.get("contractNo", "")
    if contract_no.startswith("待"):
        contract_no = _gen_contract_no(item.get("cityCode", "SH"))
    updated = {
        **item,
        "status": "正常",
        "contractNo": contract_no,
    }
    store.contracts[idx] = updated
    return updated
