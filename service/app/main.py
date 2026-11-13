from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import agent, auth, change_logs, contracts, cti, customers, dashboard, finance, integrated, ledger, notifications, schedules, stock, system, trace, uploads, work_orders
from app.core.config import settings
from app.core.exceptions import BizError
from app.core.response import fail
from app.core.scheduler import start_background_tasks, stop_background_tasks
from app.db.init_db import setup_database
from app.services.upload_service import get_upload_root


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_upload_root()
    setup_database()
    bg_tasks = start_background_tasks()
    try:
        yield
    finally:
        await stop_background_tasks(bg_tasks)


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BizError)
async def biz_error_handler(_, exc: BizError):
    return JSONResponse(fail(exc.message, exc.code))


@app.get("/health")
def health():
    return {"status": "ok"}


for mod in (auth, dashboard, work_orders, customers, stock, finance, contracts, ledger, integrated, agent, system, notifications, schedules, trace, uploads, cti, change_logs):
    app.include_router(mod.router, prefix=settings.api_prefix)

_upload_root = Path(get_upload_root())
app.mount(f"{settings.api_prefix}/files", StaticFiles(directory=str(_upload_root)), name="files")
