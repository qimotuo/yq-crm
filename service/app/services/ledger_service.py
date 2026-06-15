from datetime import datetime

from app.core.exceptions import BizError
from app.data.store import store


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _filter_by_month(items: list[dict], month: str) -> list[dict]:
    if not month:
        return items
    return [r for r in items if (r.get("entryDate") or "").startswith(month)]


def list_account_ledger(section: str = "", month: str = "", direction: str = "") -> dict:
    items = list(store.account_ledger)
    if section:
        items = [r for r in items if r.get("section") == section]
    items = _filter_by_month(items, month)
    if direction:
        items = [r for r in items if r.get("direction") == direction]
    return {"list": items, "total": len(items)}


def create_account_ledger(body: dict, created_by: str) -> dict:
    store.account_ledger_seq += 1
    item = {
        "id": store.account_ledger_seq,
        "section": body["section"],
        "direction": body["direction"],
        "category": body["category"],
        "amount": float(body.get("amount") or 0),
        "entryDate": body["entryDate"],
        "remark": body.get("remark") or "",
        "remarkOption": body.get("remarkOption") or "",
        "createdBy": created_by,
        "createTime": _now_str(),
    }
    store.account_ledger.insert(0, item)
    return item


def delete_account_ledger(record_id: int) -> dict:
    before = len(store.account_ledger)
    store.account_ledger = [r for r in store.account_ledger if r["id"] != record_id]
    if len(store.account_ledger) == before:
        raise BizError("记录不存在", 404)
    return {"ok": True}


def list_admin_ledger(month: str = "", category: str = "") -> dict:
    items = list(store.admin_ledger)
    items = _filter_by_month(items, month)
    if category:
        items = [r for r in items if r.get("category") == category]
    return {"list": items, "total": len(items)}


def create_admin_ledger(body: dict, created_by: str) -> dict:
    store.admin_ledger_seq += 1
    item = {
        "id": store.admin_ledger_seq,
        "category": body["category"],
        "amount": float(body.get("amount") or 0),
        "entryDate": body["entryDate"],
        "remark": body.get("remark") or "",
        "createdBy": created_by,
        "createTime": _now_str(),
    }
    store.admin_ledger.insert(0, item)
    return item


def delete_admin_ledger(record_id: int) -> dict:
    before = len(store.admin_ledger)
    store.admin_ledger = [r for r in store.admin_ledger if r["id"] != record_id]
    if len(store.admin_ledger) == before:
        raise BizError("记录不存在", 404)
    return {"ok": True}
