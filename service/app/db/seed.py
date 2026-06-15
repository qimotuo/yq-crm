from sqlalchemy.orm import Session

from app.core.security import DEFAULT_PASSWORD, hash_password
from datetime import date

from app.db.business_seed import seed_business_data
from app.db.models import FollowUp, Notification, Role, Schedule, User
from app.services import notify_service

DEFAULT_ROLES = [
    {
        "name": "系统管理员", "code": "admin",
        "menuKeys": ["*"], "operations": ["*"], "dataScope": "ALL", "enabled": True,
    },
    {
        "name": "销售", "code": "sales",
        "menuKeys": ["/dashboard", "/public-pool", "/my-customers", "/contacts", "/follow-ups",
                     "/schedules", "/work-orders", "/stock", "/customers"],
        "operations": ["customer:view", "customer:create", "customer:import", "customer:claim", "customer:return",
                       "customer:follow", "customer:call", "schedule:view", "schedule:create", "schedule:edit",
                       "workorder:view", "workorder:create",
                       "workorder:edit", "workorder:delete", "workorder:print", "stock:view", "stock:out",
                       "finance:view", "contract:view", "trace:view"],
        "dataScope": "SELF", "enabled": True,
    },
    {
        "name": "安装人员", "code": "installer",
        "menuKeys": ["/dashboard", "/install-register", "/stock"],
        "operations": ["workorder:view", "workorder:install", "stock:view", "stock:out", "trace:view"],
        "dataScope": "ASSIGNED", "enabled": True,
    },
    {
        "name": "财务", "code": "finance",
        "menuKeys": ["/dashboard", "/customers", "/finance", "/contracts", "/integrated", "/report-trace"],
        "operations": ["customer:view", "finance:view", "finance:create", "finance:import",
                       "finance:payment", "finance:send", "finance:export",
                       "contract:view", "contract:create", "contract:import", "contract:generate",
                       "trace:view"],
        "dataScope": "ALL", "enabled": True,
    },
    {
        "name": "仓储管理员", "code": "warehouse",
        "menuKeys": ["/dashboard", "/stock"],
        "operations": ["stock:view", "stock:in", "stock:out", "stock:export"],
        "dataScope": "ALL", "enabled": True,
    },
    {
        "name": "账户负责人", "code": "account_owner",
        "menuKeys": ["/dashboard", "/account-ledger"],
        "operations": ["account-ledger:view", "account-ledger:create", "account-ledger:delete"],
        "dataScope": "ALL", "enabled": True,
    },
    {
        "name": "行政", "code": "admin_staff",
        "menuKeys": ["/dashboard", "/admin-ledger"],
        "operations": ["admin-ledger:view", "admin-ledger:create", "admin-ledger:delete"],
        "dataScope": "ALL", "enabled": True,
    },
]

SEED_USERS = [
    {"username": "admin", "name": "管理员", "role": "admin"},
    {"username": "zhangsan", "name": "张三", "role": "sales"},
    {"username": "zhaoyun", "name": "赵云", "role": "installer"},
    {"username": "finance", "name": "财务小李", "role": "finance"},
    {"username": "xiaoyi", "name": "小伊姐", "role": "account_owner"},
    {"username": "xingzheng", "name": "行政小王", "role": "admin_staff"},
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


def seed_schedules(db: Session) -> None:
    if db.query(Schedule).count() > 0:
        return
    user = db.query(User).filter(User.username == "zhangsan").first()
    if not user:
        return
    today = date.today().isoformat()
    samples = [
        {"title": "拜访智慧社区A区", "customer_name": "智慧社区A区物业", "date": today, "time": "14:00", "type": "上门"},
        {"title": "回访滨江工业园", "customer_name": "滨江工业园管委会", "date": today, "time": "10:00", "type": "电话"},
    ]
    for s in samples:
        db.add(
            Schedule(
                user_id=user.id,
                sales_name=user.name,
                title=s["title"],
                customer_name=s["customer_name"],
                date=s["date"],
                time=s["time"],
                type=s["type"],
                status="待执行",
            )
        )
    db.commit()


def seed_follow_ups(db: Session) -> None:
    if db.query(FollowUp).count() > 0:
        return
    users = {u.name: u for u in db.query(User).all()}
    default_user = users.get("张三")
    if not default_user:
        return
    samples = [
        {
            "customer_id": 1, "customer_name": "智慧社区A区物业", "sales_name": "张三",
            "type": "电话", "content": "确认安装时间，客户要求加路由器", "next_plan": "2026-10-26 上门",
            "status": "已完成", "create_time": "2026-10-25 14:30",
        },
        {
            "customer_id": 2, "customer_name": "滨江工业园管委会", "sales_name": "李四",
            "type": "微信", "content": "发送了套餐报价", "next_plan": "2026-10-28 回访",
            "status": "待完成", "create_time": "2026-10-26 10:00",
        },
        {
            "customer_id": 4, "customer_name": "科技初创公司B", "sales_name": "赵六",
            "type": "上门", "content": "现场勘察网络环境，需10账号", "next_plan": "2026-11-01 安装",
            "status": "待完成", "create_time": "2026-10-30 16:20",
        },
    ]
    for s in samples:
        owner = users.get(s["sales_name"]) or default_user
        db.add(
            FollowUp(
                user_id=owner.id,
                customer_id=s["customer_id"],
                customer_name=s["customer_name"],
                sales_name=s["sales_name"],
                type=s["type"],
                content=s["content"],
                next_plan=s["next_plan"],
                status=s["status"],
                create_time=s["create_time"],
            )
        )
    db.commit()


def seed_demo_notifications(db: Session) -> None:
    if db.query(Notification).count() > 0:
        return
    admin = db.query(User).filter(User.username == "admin").first()
    if admin:
        notify_service.send_from_template(
            db,
            user_id=admin.id,
            template_code="workorder_pending_dispatch",
            context={"count": "2"},
        )
    zhangsan = db.query(User).filter(User.username == "zhangsan").first()
    if zhangsan:
        notify_service.ensure_schedule_reminders(db, zhangsan.id)


def init_database(db: Session) -> None:
    seed_roles(db)
    seed_users(db)
    seed_business_data(db)
    seed_schedules(db)
    seed_follow_ups(db)
    seed_demo_notifications(db)
