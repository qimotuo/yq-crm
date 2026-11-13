from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
from app.core.deps import get_current_user, require_menu, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.services.dashboard_service import dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["工作台"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(require_menu("/dashboard")),
):
    return ok(dashboard_stats(db, user=user, perms=perms))
