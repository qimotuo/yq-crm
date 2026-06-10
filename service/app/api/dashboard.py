from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.core.response import ok
from app.db.models import User
from app.services.auth_service import dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["工作台"])


@router.get("/stats")
def get_stats(_: User = Depends(get_current_user)):
    return ok(dashboard_stats())
