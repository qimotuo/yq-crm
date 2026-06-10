from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.audit import log_action
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
from app.services import audit_service, rbac_service as svc

router = APIRouter(prefix="/system", tags=["系统管理"])


@router.get("/roles")
def list_roles(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:view", "system:role:edit")),
):
    log_action(db, user, "query", "系统", "查询角色列表", request=request)
    return ok(svc.list_roles(db))


@router.get("/roles/detail")
def role_detail(
    request: Request,
    id: int | None = Query(None),
    code: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:view", "system:role:edit")),
):
    log_action(db, user, "query", "系统", f"查询角色详情 id={id} code={code}", request=request)
    return ok(svc.get_role_detail(db, role_id=id, code=code))


@router.put("/roles")
def update_role(
    body: RoleUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:edit")),
):
    result = svc.update_role(db, body.model_dump(exclude_none=True))
    log_action(db, user, "update", "系统", f"更新角色权限 id={body.id}", request=request)
    return ok(result)


@router.post("/roles")
def create_role(
    body: RoleCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:role:edit")),
):
    result = svc.create_role(db, body.model_dump())
    log_action(db, user, "create", "系统", f"新增角色 {body.code}", request=request)
    return ok(result)


@router.get("/permissions")
def permissions_by_role(
    role: str = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ok(svc.get_permissions_by_role(db, role))


@router.get("/users")
def list_users(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:view", "system:user:create", "system:user:edit")),
):
    log_action(db, user, "query", "系统", "查询用户列表", request=request)
    return ok(svc.list_users(db))


@router.post("/users")
def create_user(
    body: UserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:create")),
):
    result = svc.create_user(db, body.model_dump())
    log_action(db, user, "create", "系统", f"新增用户 {body.username}", request=request)
    return ok(result)


@router.put("/users")
def update_user(
    body: UserUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:edit")),
):
    result = svc.update_user(db, body.model_dump(exclude_none=True))
    log_action(db, user, "update", "系统", f"编辑用户 id={body.id}", request=request)
    return ok(result)


@router.delete("/users")
def delete_user(
    request: Request,
    id: int = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:delete")),
):
    svc.delete_user(db, id)
    log_action(db, user, "delete", "系统", f"删除用户 id={id}", request=request)
    return ok({"success": True})


@router.post("/users/reset-password")
def reset_password(
    body: UserIdRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:edit")),
):
    result = svc.reset_user_password(db, body.id)
    log_action(db, user, "update", "系统", f"重置密码 userId={body.id}", request=request)
    return ok(result)


@router.put("/users/toggle")
def toggle_user(
    body: UserToggleRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:user:edit")),
):
    result = svc.toggle_user_enabled(db, body.id, body.enabled)
    log_action(
        db, user, "update", "系统",
        f"{'启用' if body.enabled else '禁用'}用户 id={body.id}",
        request=request,
    )
    return ok(result)


@router.get("/logs")
def list_operation_logs(
    request: Request,
    keyword: str = "",
    action: str = "",
    module: str = "",
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    __: dict = Depends(require_operations("system:log:view")),
):
    log_action(db, user, "query", "系统", "查询操作日志", request=request)
    return ok(audit_service.list_logs(db, keyword=keyword, action=action, module=module, page=page, size=size))
