"""轻量后台定时任务（无额外依赖）。"""

from __future__ import annotations

import asyncio
import logging

from app.db.session import SessionLocal
from app.services import business_reminder_service as reminder_svc
from app.services import customer_service as customer_svc

logger = logging.getLogger(__name__)

# 开发联调友好：默认每小时扫一次；启动后约 8 秒先跑一轮
POOL_AUTO_RETURN_INTERVAL_SEC = 60 * 60
POOL_AUTO_RETURN_STARTUP_DELAY_SEC = 8
BUSINESS_REMINDER_INTERVAL_SEC = 60 * 60
BUSINESS_REMINDER_STARTUP_DELAY_SEC = 15


async def _run_pool_auto_return_once() -> None:
    db = SessionLocal()
    try:
        result = customer_svc.auto_return_stale_customers(db)
        if result.get("skipped"):
            logger.debug("公海自动退回跳过：%s", result.get("reason"))
        elif result.get("count"):
            logger.info("公海自动退回完成：%s 条", result["count"])
        else:
            logger.debug("公海自动退回扫描：无可退回客户")
    except Exception:
        logger.exception("公海自动退回任务失败")
    finally:
        db.close()


async def pool_auto_return_loop(
    interval_sec: int = POOL_AUTO_RETURN_INTERVAL_SEC,
    startup_delay_sec: int = POOL_AUTO_RETURN_STARTUP_DELAY_SEC,
) -> None:
    if startup_delay_sec > 0:
        await asyncio.sleep(startup_delay_sec)
    while True:
        await _run_pool_auto_return_once()
        await asyncio.sleep(interval_sec)


async def _run_business_reminders_once() -> None:
    db = SessionLocal()
    try:
        reminder_svc.run_business_reminders(db)
    except Exception:
        logger.exception("业务提醒扫描失败")
    finally:
        db.close()


async def business_reminder_loop(
    interval_sec: int = BUSINESS_REMINDER_INTERVAL_SEC,
    startup_delay_sec: int = BUSINESS_REMINDER_STARTUP_DELAY_SEC,
) -> None:
    if startup_delay_sec > 0:
        await asyncio.sleep(startup_delay_sec)
    while True:
        await _run_business_reminders_once()
        await asyncio.sleep(interval_sec)


def start_background_tasks() -> list[asyncio.Task]:
    return [
        asyncio.create_task(pool_auto_return_loop(), name="pool-auto-return"),
        asyncio.create_task(business_reminder_loop(), name="business-reminders"),
    ]


async def stop_background_tasks(tasks: list[asyncio.Task]) -> None:
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
