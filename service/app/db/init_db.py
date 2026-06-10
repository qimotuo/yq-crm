import logging
import time

from app.db import models  # noqa: F401
from app.db.seed import init_database
from app.db.session import Base, SessionLocal, engine

logger = logging.getLogger(__name__)


def setup_database(retries: int = 15, delay: float = 2.0) -> None:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
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
