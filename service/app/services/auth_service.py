import time

from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import Role, User
from app.services.rbac_service import _user_dict, build_permissions
from app.services.wechat_service import code_to_openid

# 登录失败锁定：同一账号 10 分钟内失败 5 次，锁定 10 分钟
_LOCK_THRESHOLD = 5
_LOCK_WINDOW_SECONDS = 600
_LOCK_SECONDS = 600
_failed_logins: dict[str, list[float]] = {}
_locked_until: dict[str, float] = {}


def _check_login_lock(username: str) -> None:
    until = _locked_until.get(username, 0)
    if until > time.time():
        minutes = int((until - time.time()) // 60) + 1
        raise BizError(f"登录失败次数过多，账号已锁定，请 {minutes} 分钟后再试")


def _record_login_failure(username: str) -> None:
    now = time.time()
    attempts = [t for t in _failed_logins.get(username, []) if now - t < _LOCK_WINDOW_SECONDS]
    attempts.append(now)
    _failed_logins[username] = attempts
    if len(attempts) >= _LOCK_THRESHOLD:
        _locked_until[username] = now + _LOCK_SECONDS
        _failed_logins.pop(username, None)


def _clear_login_failures(username: str) -> None:
    _failed_logins.pop(username, None)
    _locked_until.pop(username, None)


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
    _check_login_lock(username)
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        _record_login_failure(username)
        raise BizError("用户名或密码错误")
    if not user.enabled:
        raise BizError("账号已禁用，请联系管理员")
    _clear_login_failures(username)
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


def update_profile(db: Session, user: User, data: dict) -> dict:
    for field, attr in (
        ("name", "name"),
        ("nickname", "nickname"),
        ("phone", "phone"),
        ("email", "email"),
        ("gender", "gender"),
        ("description", "description"),
        ("avatar", "avatar"),
    ):
        if field in data and data[field] is not None:
            setattr(user, attr, data[field])
    db.commit()
    db.refresh(user)
    return {**_user_dict(user), "wxBound": bool(user.wx_open_id)}


def change_password(db: Session, user: User, old_password: str, new_password: str) -> dict:
    if not verify_password(old_password, user.password_hash):
        raise BizError("原密码错误")
    if old_password == new_password:
        raise BizError("新密码不能与原密码相同")
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"success": True}

