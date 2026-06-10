from sqlalchemy.orm import Session

from app.db.models import OperationLog


ACTION_LABELS = {
    "login": "登录",
    "query": "查询",
    "create": "新增",
    "update": "修改",
    "delete": "删除",
    "dispatch": "派工",
    "install": "安装登记",
    "claim": "领取",
    "payment": "录入回款",
}


def record(
    db: Session,
    *,
    user_id: int | None,
    username: str,
    user_name: str,
    action: str,
    module: str,
    detail: str = "",
    ip: str | None = None,
    method: str | None = None,
    path: str | None = None,
) -> OperationLog:
    row = OperationLog(
        user_id=user_id,
        username=username or "",
        user_name=user_name or "",
        action=action,
        module=module,
        detail=detail[:500],
        ip=ip,
        method=method,
        path=path,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_logs(
    db: Session,
    *,
    keyword: str = "",
    action: str = "",
    module: str = "",
    page: int = 1,
    size: int = 20,
) -> dict:
    q = db.query(OperationLog)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(
            (OperationLog.username.ilike(like))
            | (OperationLog.user_name.ilike(like))
            | (OperationLog.detail.ilike(like))
        )
    if action:
        q = q.filter(OperationLog.action == action)
    if module:
        q = q.filter(OperationLog.module == module)
    total = q.count()
    rows = q.order_by(OperationLog.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {
        "list": [_to_dict(r) for r in rows],
        "total": total,
        "page": page,
        "size": size,
    }


def _to_dict(r: OperationLog) -> dict:
    return {
        "id": r.id,
        "userId": r.user_id,
        "username": r.username,
        "userName": r.user_name,
        "action": r.action,
        "actionLabel": ACTION_LABELS.get(r.action, r.action),
        "module": r.module,
        "detail": r.detail,
        "ip": r.ip,
        "method": r.method,
        "path": r.path,
        "createdAt": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
    }
