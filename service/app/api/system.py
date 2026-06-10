from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_operations
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import (
    RoleCreateRequest,
    RoleUpdateRequest,
    UserCreateRequest,
    UserIdRequest,
    UserToggleRequest,
    UserUpdateRequest,
)
from app.services import rbac_service as svc

router = APIRouter(prefix="/system", tags=["系统管理"])


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:view", "system:role:edit")),
):
    return ok(svc.list_roles(db))


@router.get("/roles/detail")
def role_detail(
    id: int | None = Query(None),
    code: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:view", "system:role:edit")),
):
    return ok(svc.get_role_detail(db, role_id=id, code=code))


@router.put("/roles")
def update_role(
    body: RoleUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:edit")),
):
    return ok(svc.update_role(db, body.model_dump(exclude_none=True)))


@router.post("/roles")
def create_role(
    body: RoleCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:edit")),
):
    return ok(svc.create_role(db, body.model_dump()))


@router.get("/permissions")
def permissions_by_role(
    role: str = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return ok(svc.get_permissions_by_role(db, role))


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:view", "system:user:create", "system:user:edit")),
):
    return ok(svc.list_users(db))


@router.post("/users")
def create_user(
    body: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:create")),
):
    return ok(svc.create_user(db, body.model_dump()))


@router.put("/users")
def update_user(
    body: UserUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:edit")),
):
    return ok(svc.update_user(db, body.model_dump(exclude_none=True)))


@router.delete("/users")
def delete_user(
    id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:delete")),
):
    return ok(svc.delete_user(db, id))


@router.post("/users/reset-password")
def reset_password(
    body: UserIdRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:edit")),
):
    return ok(svc.reset_user_password(db, body.id))


@router.put("/users/toggle")
def toggle_user(
    body: UserToggleRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:edit")),
):
    return ok(svc.toggle_user_enabled(db, body.id, body.enabled))
