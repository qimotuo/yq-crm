from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.security import create_access_token, verify_password
from app.db.models import Role, User
from app.services.rbac_service import _user_dict, build_permissions
from app.services.wechat_service import code_to_openid


def _login_result(db: Session, user: User) -> dict:
    role = db.query(Role).filter(Role.code == user.role_code, Role.enabled.is_(True)).first()
    permissions = build_permissions(role) if role else {"menuKeys": [], "operations": [], "dataScope": "SELF"}
    token = create_access_token(user.id, user.username, user.role_code)
    return {
        "token": token,
        "user": _user_dict(user),
        "permissions": permissions,
    }


def login(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise BizError("用户名或密码错误")
    if not user.enabled:
        raise BizError("账号已禁用，请联系管理员")
    return _login_result(db, user)


def wechat_login(db: Session, code: str) -> dict:
    openid = code_to_openid(code)
    user = db.query(User).filter(User.wx_open_id == openid).first()
    if not user:
        raise BizError("微信未绑定账号，请先用账号登录并在「我的」中绑定微信")
    if not user.enabled:
        raise BizError("账号已禁用，请联系管理员")
    return _login_result(db, user)


def bind_wechat(db: Session, user: User, code: str) -> dict:
    openid = code_to_openid(code)
    taken = db.query(User).filter(User.wx_open_id == openid, User.id != user.id).first()
    if taken:
        raise BizError("该微信已绑定其他账号")
    user.wx_open_id = openid
    db.commit()
    masked = f"{openid[:6]}***{openid[-4:]}" if len(openid) > 10 else openid
    return {"bound": True, "openid": masked}


def get_me(db: Session, user: User) -> dict:
    role = db.query(Role).filter(Role.code == user.role_code, Role.enabled.is_(True)).first()
    permissions = build_permissions(role) if role else {"menuKeys": [], "operations": [], "dataScope": "SELF"}
    return {
        "user": {**_user_dict(user), "wxBound": bool(user.wx_open_id)},
        "permissions": permissions,
    }

