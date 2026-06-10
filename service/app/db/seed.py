from sqlalchemy.orm import Session

from app.core.security import DEFAULT_PASSWORD, hash_password
from app.db.models import Role, User

DEFAULT_ROLES = [
    {
        "name": "系统管理员", "code": "admin",
        "menuKeys": ["*"], "operations": ["*"], "dataScope": "ALL", "enabled": True,
    },
    {
        "name": "销售", "code": "sales",
        "menuKeys": ["/dashboard", "/public-pool", "/my-customers", "/contacts", "/follow-ups",
                     "/schedules", "/work-orders", "/stock", "/customers"],
        "operations": ["customer:view", "customer:import", "customer:claim", "customer:return",
                       "customer:follow", "customer:call", "workorder:view", "workorder:create",
                       "workorder:edit", "workorder:delete", "workorder:print", "stock:view", "stock:out"],
        "dataScope": "SELF", "enabled": True,
    },
    {
        "name": "安装人员", "code": "installer",
        "menuKeys": ["/dashboard", "/dispatch", "/install-register", "/stock"],
        "operations": ["workorder:view", "workorder:install", "stock:view"],
        "dataScope": "ASSIGNED", "enabled": True,
    },
    {
        "name": "财务", "code": "finance",
        "menuKeys": ["/dashboard", "/customers", "/finance", "/contracts", "/integrated", "/report-trace"],
        "operations": ["customer:view", "finance:view", "finance:payment", "finance:send", "finance:export"],
        "dataScope": "ALL", "enabled": True,
    },
    {
        "name": "仓储管理员", "code": "warehouse",
        "menuKeys": ["/dashboard", "/stock"],
        "operations": ["stock:view", "stock:in", "stock:out", "stock:export"],
        "dataScope": "ALL", "enabled": True,
    },
]

SEED_USERS = [
    {"username": "admin", "name": "管理员", "role": "admin"},
    {"username": "zhangsan", "name": "张三", "role": "sales"},
    {"username": "zhaoyun", "name": "赵云", "role": "installer"},
    {"username": "finance", "name": "财务小李", "role": "finance"},
]


def seed_roles(db: Session) -> None:
    if db.query(Role).count() > 0:
        return
    for item in DEFAULT_ROLES:
        db.add(
            Role(
                name=item["name"],
                code=item["code"],
                menu_keys=item["menuKeys"],
                operations=item["operations"],
                data_scope=item["dataScope"],
                enabled=item.get("enabled", True),
            )
        )
    db.commit()


def seed_users(db: Session) -> None:
    if db.query(User).count() > 0:
        return
    pwd = hash_password(DEFAULT_PASSWORD)
    for item in SEED_USERS:
        db.add(
            User(
                username=item["username"],
                password_hash=pwd,
                name=item["name"],
                role_code=item["role"],
                enabled=True,
            )
        )
    db.commit()


def init_database(db: Session) -> None:
    seed_roles(db)
    seed_users(db)
