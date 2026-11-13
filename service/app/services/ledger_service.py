from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import AccountLedgerEntry, AdminLedgerEntry


def _now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _account_to_dict(r: AccountLedgerEntry) -> dict:
    return {
        "id": r.id, "section": r.section, "direction": r.direction,
        "category": r.category, "amount": r.amount, "entryDate": r.entry_date,
        "remark": r.remark, "remarkOption": r.remark_option,
        "createdBy": r.created_by, "createTime": r.create_time,
    }


def _admin_to_dict(r: AdminLedgerEntry) -> dict:
    return {
        "id": r.id, "category": r.category, "amount": r.amount,
        "entryDate": r.entry_date, "remark": r.remark,
        "createdBy": r.created_by, "createTime": r.create_time,
    }


def list_account_ledger(db: Session, section: str = "", month: str = "", direction: str = "") -> dict:
    q = db.query(AccountLedgerEntry)
    if section:
        q = q.filter(AccountLedgerEntry.section == section)
    if month:
        q = q.filter(AccountLedgerEntry.entry_date.like(f"{month}%"))
    if direction:
        q = q.filter(AccountLedgerEntry.direction == direction)
    rows = q.order_by(AccountLedgerEntry.id.desc()).all()
    items = [_account_to_dict(r) for r in rows]
    return {"list": items, "total": len(items)}


def create_account_ledger(db: Session, body: dict, created_by: str) -> dict:
    row = AccountLedgerEntry(
        section=body["section"],
        direction=body["direction"],
        category=body["category"],
        amount=float(body.get("amount") or 0),
        entry_date=body["entryDate"],
        remark=body.get("remark") or "",
        remark_option=body.get("remarkOption") or "",
        created_by=created_by,
        create_time=_now_str(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _account_to_dict(row)


def delete_account_ledger(db: Session, record_id: int) -> dict:
    row = db.query(AccountLedgerEntry).filter(AccountLedgerEntry.id == record_id).first()
    if not row:
        raise BizError("记录不存在", 404)
    db.delete(row)
    db.commit()
    return {"ok": True}


def list_admin_ledger(db: Session, month: str = "", category: str = "") -> dict:
    q = db.query(AdminLedgerEntry)
    if month:
        q = q.filter(AdminLedgerEntry.entry_date.like(f"{month}%"))
    if category:
        q = q.filter(AdminLedgerEntry.category == category)
    rows = q.order_by(AdminLedgerEntry.id.desc()).all()
    items = [_admin_to_dict(r) for r in rows]
    return {"list": items, "total": len(items)}


def create_admin_ledger(db: Session, body: dict, created_by: str) -> dict:
    row = AdminLedgerEntry(
        category=body["category"],
        amount=float(body.get("amount") or 0),
        entry_date=body["entryDate"],
        remark=body.get("remark") or "",
        created_by=created_by,
        create_time=_now_str(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _admin_to_dict(row)


_ADMIN_CATEGORIES = {"日常账单", "公司运营账单"}


def import_admin_ledger(db: Session, rows: list[dict], created_by: str) -> dict:
    if not rows:
        raise BizError("导入数据为空")
    count = 0
    for i, row in enumerate(rows, start=1):
        category = str(row.get("category") or "").strip()
        if category not in _ADMIN_CATEGORIES:
            raise BizError(f"第 {i} 行账单类型无效，只能是日常账单或公司运营账单")
        entry_date = str(row.get("entryDate") or "").strip()[:10]
        remark = str(row.get("remark") or "").strip()
        if not entry_date or not remark:
            raise BizError(f"第 {i} 行缺少日期或用途备注")
        try:
            amount = float(row.get("amount") or 0)
        except (TypeError, ValueError):
            raise BizError(f"第 {i} 行金额无效")
        if amount <= 0:
            raise BizError(f"第 {i} 行金额需大于 0")
        db.add(AdminLedgerEntry(
            category=category,
            amount=amount,
            entry_date=entry_date,
            remark=remark,
            created_by=created_by,
            create_time=_now_str(),
        ))
        count += 1
    db.commit()
    return {"count": count}


def delete_admin_ledger(db: Session, record_id: int) -> dict:
    row = db.query(AdminLedgerEntry).filter(AdminLedgerEntry.id == record_id).first()
    if not row:
        raise BizError("记录不存在", 404)
    db.delete(row)
    db.commit()
    return {"ok": True}
