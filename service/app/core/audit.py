"""操作审计 — 统一记录用户行为。"""

from fastapi import Request
from sqlalchemy.orm import Session

from app.db.models import User
from app.services import audit_service


def log_action(
    db: Session,
    user: User | None,
    action: str,
    module: str,
    detail: str = "",
    *,
    request: Request | None = None,
) -> None:
    ip = None
    method = None
    path = None
    if request is not None:
        ip = request.client.host if request.client else None
        method = request.method
        path = str(request.url.path)
    audit_service.record(
        db,
        user_id=user.id if user else None,
        username=user.username if user else "",
        user_name=user.name if user else "",
        action=action,
        module=module,
        detail=detail,
        ip=ip,
        method=method,
        path=path,
    )
