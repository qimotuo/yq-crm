from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.security import decode_token
from app.db.models import Role, User
from app.db.session import get_db
from app.services.rbac_service import build_permissions


def _extract_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise BizError("未登录", 401)
    return authorization.removeprefix("Bearer ").strip()


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: Session = Depends(get_db),
) -> User:
    token = _extract_token(authorization)
    payload = decode_token(token)
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise BizError("用户不存在", 401)
    if not user.enabled:
        raise BizError("账号已禁用", 401)
    return user


def get_current_permissions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    role = db.query(Role).filter(Role.code == user.role_code, Role.enabled.is_(True)).first()
    if not role:
        return {"menuKeys": [], "operations": [], "dataScope": "SELF"}
    return build_permissions(role)


def require_operations(*codes: str):
    def checker(permissions: dict = Depends(get_current_permissions)) -> dict:
        ops = permissions.get("operations") or []
        if "*" in ops:
            return permissions
        if not any(code in ops for code in codes):
            raise BizError("无操作权限", 403)
        return permissions

    return checker
