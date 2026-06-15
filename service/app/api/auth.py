from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest, WechatCodeRequest
from app.services.auth_service import bind_wechat, get_me, login, wechat_login

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login")
def auth_login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    result = login(db, body.username, body.password)
    user = db.query(User).filter(User.username == body.username).first()
    log_action(db, user, "login", "系统", f"用户 {body.username} 登录成功", request=request)
    return ok(result)


@router.get("/me")
def auth_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(get_me(db, user))


@router.post("/wechat-login")
def auth_wechat_login(body: WechatCodeRequest, request: Request, db: Session = Depends(get_db)):
    result = wechat_login(db, body.code)
    user = db.query(User).filter(User.username == result["user"]["username"]).first()
    if user:
        log_action(db, user, "login", "系统", f"用户 {user.username} 微信登录成功", request=request)
    return ok(result)


@router.post("/wechat-bind")
def auth_wechat_bind(
    body: WechatCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = bind_wechat(db, user, body.code)
    log_action(db, user, "update", "系统", "绑定微信账号", request=request)
    return ok(result)
