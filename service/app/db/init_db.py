import logging
import time

from sqlalchemy import text

from app.db import models  # noqa: F401
from app.db.seed import init_database
from app.db.session import Base, SessionLocal, engine

logger = logging.getLogger(__name__)


def _migrate_schema() -> None:
    with engine.begin() as conn:
        for col, ddl in (
            ("nickname", "VARCHAR(64) NOT NULL DEFAULT ''"),
            ("phone", "VARCHAR(20) NOT NULL DEFAULT ''"),
            ("email", "VARCHAR(128) NOT NULL DEFAULT ''"),
            ("gender", "VARCHAR(8) NOT NULL DEFAULT ''"),
            ("description", "TEXT NOT NULL DEFAULT ''"),
            ("avatar", "TEXT NOT NULL DEFAULT ''"),
            ("dept_code", "VARCHAR(32) NOT NULL DEFAULT ''"),
        ):
            conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {ddl}"))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_users_dept_code ON users (dept_code)"
        ))
        # 按角色补默认部门（仅空值）
        for role_code, dept in (
            ("sales", "sales"),
            ("installer", "ops"),
            ("finance", "finance"),
            ("warehouse", "warehouse"),
            ("admin", "admin"),
            ("account_owner", "admin"),
            ("admin_staff", "admin"),
        ):
            conn.execute(text(
                "UPDATE users SET dept_code = :dept "
                "WHERE role_code = :role AND (dept_code IS NULL OR dept_code = '')"
            ), {"dept": dept, "role": role_code})
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS wx_open_id VARCHAR(64)"
        ))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_wx_open_id "
            "ON users (wx_open_id) WHERE wx_open_id IS NOT NULL"
        ))
        conn.execute(text(
            "ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_id INTEGER"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_work_orders_customer_id ON work_orders (customer_id)"
        ))
        for col, ddl in (
            ("install_remark", "TEXT NOT NULL DEFAULT ''"),
            ("install_time_slot", "VARCHAR(64) NOT NULL DEFAULT ''"),
            ("price", "VARCHAR(64) NOT NULL DEFAULT ''"),
            ("postpone_date", "VARCHAR(64) NOT NULL DEFAULT ''"),
            ("fail_reason", "TEXT NOT NULL DEFAULT ''"),
            ("backup_iccid", "VARCHAR(32) NOT NULL DEFAULT ''"),
            ("flow_logs", "JSONB NOT NULL DEFAULT '[]'::jsonb"),
            ("updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
        ):
            conn.execute(text(
                f"ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS {col} {ddl}"
            ))
        conn.execute(text(
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS price VARCHAR(64) NOT NULL DEFAULT ''"
        ))
        for col in ("device_cost", "card_cost"):
            conn.execute(text(
                f"ALTER TABLE customers ADD COLUMN IF NOT EXISTS {col} VARCHAR(32) NOT NULL DEFAULT ''"
            ))
            conn.execute(text(
                f"ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS {col} VARCHAR(32) NOT NULL DEFAULT ''"
            ))
        for col, ddl in (
            ("card_package", "VARCHAR(64) NOT NULL DEFAULT ''"),
            ("card_expire_date", "VARCHAR(16) NOT NULL DEFAULT ''"),
        ):
            for table in ("customers", "work_orders"):
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {ddl}"))
        conn.execute(text(
            "ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS store_name VARCHAR(128) NOT NULL DEFAULT ''"
        ))
        conn.execute(text(
            "UPDATE follow_ups AS f SET store_name = c.store_name "
            "FROM customers AS c "
            "WHERE f.customer_id = c.id AND f.store_name = '' AND c.store_name <> ''"
        ))
        for col, ddl in (
            ("id_card_front", "VARCHAR(512) NOT NULL DEFAULT ''"),
            ("id_card_back", "VARCHAR(512) NOT NULL DEFAULT ''"),
            ("owner_status", "VARCHAR(16) NOT NULL DEFAULT 'confirmed'"),
            ("owner_note", "VARCHAR(512) NOT NULL DEFAULT ''"),
        ):
            conn.execute(text(f"ALTER TABLE customers ADD COLUMN IF NOT EXISTS {col} {ddl}"))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_customers_owner_status ON customers (owner_status)"
        ))
        conn.execute(text(
            "ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS install_photos JSONB NOT NULL DEFAULT '[]'::jsonb"
        ))
        conn.execute(text(
            "ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS thinking TEXT NOT NULL DEFAULT ''"
        ))
        for col, ddl in (
            ("signer_name", "VARCHAR(64) NOT NULL DEFAULT ''"),
            ("signer_phone", "VARCHAR(20) NOT NULL DEFAULT ''"),
            ("signer_id_no", "VARCHAR(18) NOT NULL DEFAULT ''"),
            ("sign_date", "VARCHAR(16) NOT NULL DEFAULT ''"),
            ("template_key", "VARCHAR(32) NOT NULL DEFAULT ''"),
        ):
            conn.execute(text(f"ALTER TABLE contracts ADD COLUMN IF NOT EXISTS {col} {ddl}"))
        conn.execute(text(
            "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT '{}'::jsonb"
        ))
        conn.execute(text(
            "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS doc_path VARCHAR(256) NOT NULL DEFAULT ''"
        ))
        conn.execute(text(
            "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS doc_name VARCHAR(256) NOT NULL DEFAULT ''"
        ))
        conn.execute(text(
            "UPDATE roles SET operations = operations || '\"stock:out\"'::jsonb "
            "WHERE code = 'installer' AND NOT (operations @> '[\"stock:out\"]'::jsonb) "
            "AND NOT (operations @> '[\"*\"]'::jsonb)"
        ))
        for code, op in (
            ("sales", "finance:view"),
            ("sales", "contract:view"),
            ("sales", "trace:view"),
            ("installer", "trace:view"),
            ("finance", "trace:view"),
            ("finance", "integrated:import"),
            ("sales", "customer:edit"),
            ("finance", "finance:edit"),
            ("finance", "contract:edit"),
            ("finance", "integrated:edit"),
        ):
            conn.execute(text(
                f"UPDATE roles SET operations = operations || '\"{op}\"'::jsonb "
                f"WHERE code = '{code}' AND NOT (operations @> '[\"{op}\"]'::jsonb) "
                f"AND NOT (operations @> '[\"*\"]'::jsonb)"
            ))
        # 销售可见财务 / 合同菜单（数据权限仍按 SELF/DEPT 过滤）
        for code, key in (
            ("sales", "/finance"),
            ("sales", "/contracts"),
        ):
            conn.execute(text(
                f"UPDATE roles SET menu_keys = menu_keys || '\"{key}\"'::jsonb "
                f"WHERE code = '{code}' AND NOT (menu_keys @> '[\"{key}\"]'::jsonb) "
                f"AND NOT (menu_keys @> '[\"*\"]'::jsonb)"
            ))
        for table, cols in (
            ("stock_in", (
                ("store_name", "VARCHAR(128) NOT NULL DEFAULT ''"),
                ("order_no", "VARCHAR(32) NOT NULL DEFAULT ''"),
                ("mobile_no", "VARCHAR(32) NOT NULL DEFAULT ''"),
                ("telecom_no", "VARCHAR(32) NOT NULL DEFAULT ''"),
                ("replaced_card_no", "VARCHAR(32) NOT NULL DEFAULT ''"),
            )),
            ("stock_out", (
                ("mobile_no", "VARCHAR(32) NOT NULL DEFAULT ''"),
                ("telecom_no", "VARCHAR(32) NOT NULL DEFAULT ''"),
                ("replaced_card_no", "VARCHAR(32) NOT NULL DEFAULT ''"),
            )),
        ):
            for col, ddl in cols:
                conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {ddl}"
                ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_stock_in_order_no ON stock_in (order_no)"
        ))
        conn.execute(text(
            "ALTER TABLE operation_logs ADD COLUMN IF NOT EXISTS target_id VARCHAR(64) NOT NULL DEFAULT ''"
        ))
        conn.execute(text(
            "ALTER TABLE operation_logs ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '[]'::jsonb"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_operation_logs_target_id ON operation_logs (target_id)"
        ))
        # 日期时间字段放宽（含时分秒共 19 字符）
        for table, col in (
            ("stock_in", "in_date"),
            ("sim_stock_in", "in_date"),
            ("stock_out", "out_date"),
            ("return_logs", "return_time"),
            ("account_ledger", "create_time"),
            ("admin_ledger", "create_time"),
        ):
            conn.execute(text(
                f"ALTER TABLE {table} ALTER COLUMN {col} TYPE VARCHAR(32)"
            ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(64) PRIMARY KEY)"
        ))


def _expand_ops(ops: list[str], extra: list[str], drop: set[str] | None = None) -> list[str]:
    drop = drop or set()
    merged: list[str] = []
    for code in list(ops) + extra:
        if code in drop or code in merged:
            continue
        merged.append(code)
    return merged


def _migrate_role_permissions() -> None:
    """把按模块共用的操作码拆到各菜单。只跑一次，避免覆盖后来在界面里改过的权限。"""
    from sqlalchemy.orm.attributes import flag_modified

    from app.db.models import Role

    db = SessionLocal()
    try:
        done = db.execute(text(
            "SELECT 1 FROM schema_migrations WHERE id = 'rbac_menu_ops_v1'"
        )).first()
        if done:
            return
        obsolete = {"customer:claim", "customer:return", "customer:follow", "customer:call"}
        for role in db.query(Role).all():
            ops = list(role.operations or [])
            if "*" in ops:
                continue
            if role.code == "admin_staff":
                role.operations = ["admin-ledger:view", "admin-ledger:import"]
                flag_modified(role, "operations")
                continue
            extra: list[str] = []
            if "customer:view" in ops:
                extra += ["public-pool:view", "my-customer:view", "contact:view", "follow:view"]
            if "customer:create" in ops:
                extra += ["public-pool:create", "my-customer:create", "contact:create"]
            if "customer:edit" in ops:
                extra += ["my-customer:edit", "contact:edit"]
            if "customer:import" in ops:
                extra += ["public-pool:import", "my-customer:import", "contact:import"]
            if "customer:claim" in ops:
                extra.append("public-pool:claim")
            if "customer:return" in ops:
                extra.append("my-customer:return")
            if "customer:follow" in ops:
                extra += ["my-customer:follow", "follow:create"]
            if "customer:call" in ops:
                extra += ["my-customer:call", "contact:call"]
            if "stock:in" in ops or "stock:out" in ops:
                extra.append("stock:import")
            if "system:user:create" in ops:
                extra.append("system:user:import")
            if role.code == "installer" or "workorder:install" in ops:
                extra.append("install:view")
            if role.code == "finance" or "integrated:import" in ops:
                extra += ["integrated:view", "integrated:export", "contract:export"]
            drop = set(obsolete)
            if role.code == "installer":
                drop.add("workorder:view")
            merged = _expand_ops(ops, extra, drop)
            if merged != ops:
                role.operations = merged
                flag_modified(role, "operations")
        db.execute(text(
            "INSERT INTO schema_migrations (id) VALUES ('rbac_menu_ops_v1')"
        ))
        db.commit()
    finally:
        db.close()


def _migrate_role_permissions_v2() -> None:
    """把仍共用的按钮权限拆到各自菜单。只跑一次。"""
    from sqlalchemy.orm.attributes import flag_modified

    from app.db.models import Role

    db = SessionLocal()
    try:
        done = db.execute(text(
            "SELECT 1 FROM schema_migrations WHERE id = 'rbac_menu_ops_v2'"
        )).first()
        if done:
            return
        for role in db.query(Role).all():
            ops = list(role.operations or [])
            if "*" in ops:
                continue
            menus = list(role.menu_keys or [])
            has_menu = lambda key: "*" in menus or key in menus
            extra: list[str] = []
            if "pool-config:edit" in ops:
                extra.append("pool-config:scan")
            if "my-customer:view" in ops:
                extra += ["my-customer:wechat", "my-customer:workorder"]
            if "customer:view" in ops:
                extra.append("customer:payment-log")
            if "customer:edit" in ops:
                extra.append("customer:delete")
            if "finance:payment" in ops and (has_menu("/customers") or "customer:view" in ops):
                extra.append("customer:payment")
            if "contract:view" in ops:
                extra.append("contract:print")
            if "integrated:view" in ops:
                extra.append("integrated:asset")
            if "finance:payment" in ops and (has_menu("/integrated") or "integrated:view" in ops):
                extra.append("integrated:payment")
            if "finance:send" in ops and (has_menu("/integrated") or "integrated:view" in ops):
                extra.append("integrated:send")
            if "workorder:dispatch" in ops:
                extra += ["dispatch:assign", "dispatch:confirm"]
            if "workorder:edit" in ops and has_menu("/dispatch"):
                extra.append("dispatch:edit")
            if "workorder:create" in ops and has_menu("/dispatch"):
                extra.append("dispatch:create")
            if "workorder:print" in ops and has_menu("/dispatch"):
                extra.append("dispatch:print")
            if "workorder:install" in ops:
                extra += ["install:start", "install:register", "install:fail"]
            if "workorder:edit" in ops and has_menu("/install-register"):
                extra.append("install:edit")
            if "workorder:create" in ops and has_menu("/install-register"):
                extra.append("install:create")
            if "workorder:edit" in ops and has_menu("/work-order-query"):
                extra.append("workorder-query:edit")
            if "workorder:create" in ops and has_menu("/work-order-query"):
                extra.append("workorder-query:create")
            if "stock:in" in ops:
                extra += ["stock:in:edit", "stock:in:delete", "stock:sim", "stock:sim:edit", "stock:sim:delete"]
            if "stock:import" in ops:
                extra += ["stock:in:import", "stock:sim:import", "stock:out:import"]
            if "stock:export" in ops:
                extra += ["stock:in:export", "stock:sim:export", "stock:out:export"]
            if "system:user:edit" in ops:
                extra += ["system:user:reset", "system:user:enable"]
            merged = _expand_ops(ops, extra)
            if merged != ops:
                role.operations = merged
                flag_modified(role, "operations")
        db.execute(text(
            "INSERT INTO schema_migrations (id) VALUES ('rbac_menu_ops_v2')"
        ))
        db.commit()
    finally:
        db.close()


def _migrate_role_permissions_v3() -> None:
    """补回款记录权限。只跑一次。"""
    from sqlalchemy.orm.attributes import flag_modified

    from app.db.models import Role

    db = SessionLocal()
    try:
        done = db.execute(text(
            "SELECT 1 FROM schema_migrations WHERE id = 'rbac_menu_ops_v3'"
        )).first()
        if done:
            return
        for role in db.query(Role).all():
            ops = list(role.operations or [])
            if "*" in ops or "customer:view" not in ops:
                continue
            merged = _expand_ops(ops, ["customer:payment-log"])
            if merged != ops:
                role.operations = merged
                flag_modified(role, "operations")
        db.execute(text(
            "INSERT INTO schema_migrations (id) VALUES ('rbac_menu_ops_v3')"
        ))
        db.commit()
    finally:
        db.close()


def setup_database(retries: int = 15, delay: float = 2.0) -> None:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            _migrate_schema()
            db = SessionLocal()
            try:
                init_database(db)
                _migrate_role_permissions()
                _migrate_role_permissions_v2()
                _migrate_role_permissions_v3()
                from app.services.customer_owner import init_customer_ownership

                init_customer_ownership(db)
            finally:
                db.close()
            return
        except Exception as exc:
            last_err = exc
            logger.warning("数据库初始化失败（%s/%s）: %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(delay)
    raise last_err  # type: ignore[misc]
