from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginRequest
from app.services.auth_service import get_me, login

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login")
def auth_login(body: LoginRequest, db: Session = Depends(get_db)):
    return ok(login(db, body.username, body.password))


@router.get("/me")
def auth_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(get_me(db, user))
