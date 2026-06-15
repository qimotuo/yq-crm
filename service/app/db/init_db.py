import logging
import time

from sqlalchemy import text

from app.db import models  # noqa: F401
from app.db.seed import init_database
from app.db.session import Base, SessionLocal, engine

logger = logging.getLogger(__name__)


def _migrate_schema() -> None:
    with engine.begin() as conn:
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
        ):
            conn.execute(text(
                f"UPDATE roles SET operations = operations || '\"{op}\"'::jsonb "
                f"WHERE code = '{code}' AND NOT (operations @> '[\"{op}\"]'::jsonb) "
                f"AND NOT (operations @> '[\"*\"]'::jsonb)"
            ))


def setup_database(retries: int = 15, delay: float = 2.0) -> None:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            _migrate_schema()
            db = SessionLocal()
            try:
                init_database(db)
            finally:
                db.close()
            return
        except Exception as exc:
            last_err = exc
            logger.warning("数据库初始化失败（%s/%s）: %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(delay)
    raise last_err  # type: ignore[misc]
