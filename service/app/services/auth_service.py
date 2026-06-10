from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.security import create_access_token, verify_password
from app.db.models import Role, User
from app.services.rbac_service import _user_dict, build_permissions


def login(db: Session, username: str, password: str) -> dict:
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise BizError("用户名或密码错误")
    if not user.enabled:
        raise BizError("账号已禁用，请联系管理员")

    role = db.query(Role).filter(Role.code == user.role_code, Role.enabled.is_(True)).first()
    permissions = build_permissions(role) if role else {"menuKeys": [], "operations": [], "dataScope": "SELF"}
    token = create_access_token(user.id, user.username, user.role_code)
    return {
        "token": token,
        "user": _user_dict(user),
        "permissions": permissions,
    }


def get_me(db: Session, user: User) -> dict:
    role = db.query(Role).filter(Role.code == user.role_code, Role.enabled.is_(True)).first()
    permissions = build_permissions(role) if role else {"menuKeys": [], "operations": [], "dataScope": "SELF"}
    return {"user": _user_dict(user), "permissions": permissions}


def dashboard_stats() -> dict:
    from app.data.store import store

    today = str(__import__("datetime").date.today())
    return {
        "totalOrders": len(store.work_orders) + 125,
        "pendingDispatch": sum(1 for o in store.work_orders if o["status"] == "待派工"),
        "installing": sum(1 for o in store.work_orders if o["status"] in ("已派工", "安装中")),
        "completed": 96,
        "totalCustomers": 86,
        "monthlyRevenue": 87000,
        "unpaidAmount": 32000,
        "overdueCount": 3,
        "publicPoolCount": sum(1 for c in store.public_pool if c["status"] == "在公海"),
        "lowStockCount": 2,
        "todaySchedules": sum(1 for s in store.schedules if s["date"] == today and s["status"] == "待执行"),
    }
