from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest
from app.services.auth_service import get_me, login

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
