from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import agent, auth, customers, dashboard, notifications, schedules, system, work_orders
from app.core.config import settings
from app.core.exceptions import BizError
from app.core.response import fail
from app.db.init_db import setup_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_database()
    yield


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


for mod in (auth, dashboard, work_orders, customers, agent, system, notifications, schedules):
    app.include_router(mod.router, prefix=settings.api_prefix)
