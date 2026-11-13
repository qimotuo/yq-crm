from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.core.security import DEFAULT_PASSWORD, hash_password
from app.db.models import Role, User

SCOPE_LABEL = {
    "ALL": "全部数据",
    "SELF": "仅本人",
    "ASSIGNED": "仅分配",
    "DEPT": "本部门",
}


def build_permissions(role: Role) -> dict:
    return {
        "menuKeys": role.menu_keys or [],
        "operations": role.operations or [],
        "dataScope": role.data_scope,
    }


def _role_counts(db: Session) -> dict[str, int]:
    rows = db.query(User.role_code, func.count(User.id)).group_by(User.role_code).all()
    return {code: count for code, count in rows}


def _format_role_list_item(role: Role, user_count: int) -> dict:
    menu_keys = role.menu_keys or []
    menus = "全部菜单" if "*" in menu_keys else f"{len(menu_keys)} 项菜单"
    return {
        "id": role.id,
        "name": role.name,
        "code": role.code,
        "menuKeys": menu_keys,
        "operations": role.operations or [],
        "dataScope": role.data_scope,
        "enabled": role.enabled,
        "userCount": user_count,
        "menus": menus,
    }


def _role_detail(role: Role) -> dict:
    return {
        "id": role.id,
        "name": role.name,
        "code": role.code,
        "menuKeys": role.menu_keys or [],
        "operations": role.operations or [],
        "dataScope": role.data_scope,
        "enabled": role.enabled,
    }


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "nickname": user.nickname or "",
        "role": user.role_code,
        "enabled": user.enabled,
        "phone": user.phone or "",
        "email": user.email or "",
        "gender": user.gender or "",
        "description": user.description or "",
        "avatar": user.avatar or "",
        "deptCode": user.dept_code or "",
    }


def get_role_by_code(db: Session, code: str) -> Role | None:
    return db.query(Role).filter(Role.code == code).first()


def list_roles(
    db: Session,
    *,
    keyword: str = "",
    data_scope: str = "",
    enabled: str = "",
) -> dict:
    q = db.query(Role)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter((Role.name.ilike(like)) | (Role.code.ilike(like)))
    if data_scope:
        q = q.filter(Role.data_scope == data_scope)
    if enabled in ("true", "false"):
        q = q.filter(Role.enabled == (enabled == "true"))
    counts = _role_counts(db)
    roles = q.order_by(Role.id).all()
    items = [_format_role_list_item(r, counts.get(r.code, 0)) for r in roles]
    return {"list": items, "total": len(items)}


def get_role_detail(db: Session, role_id: int | None = None, code: str | None = None) -> dict | None:
    q = db.query(Role)
    if role_id is not None:
        role = q.filter(Role.id == role_id).first()
    elif code:
        role = q.filter(Role.code == code).first()
    else:
        return None
    return _role_detail(role) if role else None


def update_role(db: Session, data: dict) -> dict:
    role = db.query(Role).filter(Role.id == data["id"]).first()
    if not role:
        raise BizError("角色不存在")
    if role.code == "admin":
        raise BizError("不能修改管理员角色权限")
    for field, attr in (
        ("name", "name"),
        ("menuKeys", "menu_keys"),
        ("operations", "operations"),
        ("dataScope", "data_scope"),
        ("enabled", "enabled"),
    ):
        if field in data and data[field] is not None:
            setattr(role, attr, data[field])
    db.commit()
    db.refresh(role)
    return _role_detail(role)


def create_role(db: Session, data: dict) -> dict:
    if db.query(Role).filter(Role.code == data["code"]).first():
        raise BizError("角色编码已存在")
    role = Role(
        name=data["name"],
        code=data["code"],
        menu_keys=data.get("menuKeys") or [],
        operations=data.get("operations") or [],
        data_scope=data.get("dataScope") or "SELF",
        enabled=data.get("enabled", True),
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return _role_detail(role)


def get_permissions_by_role(db: Session, role_code: str) -> dict | None:
    role = get_role_by_code(db, role_code)
    if not role:
        return None
    perms = build_permissions(role)
    return {"role": role.code, **perms}


def list_users(
    db: Session,
    *,
    keyword: str = "",
    role: str = "",
    enabled: str = "",
) -> dict:
    q = db.query(User)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(
            (User.username.ilike(like))
            | (User.name.ilike(like))
            | (User.nickname.ilike(like))
            | (User.phone.ilike(like))
            | (User.email.ilike(like))
        )
    if role:
        q = q.filter(User.role_code == role)
    if enabled in ("true", "false"):
        q = q.filter(User.enabled == (enabled == "true"))
    users = q.order_by(User.id).all()
    items = [_user_dict(u) for u in users]
    return {"list": items, "total": len(items)}


def create_user(db: Session, data: dict) -> dict:
    if db.query(User).filter(User.username == data["username"]).first():
        raise BizError("用户名已存在")
    if not get_role_by_code(db, data["role"]):
        raise BizError("角色不存在")
    user = User(
        username=data["username"],
        name=data["name"],
        nickname=data.get("nickname") or "",
        role_code=data["role"],
        password_hash=hash_password(DEFAULT_PASSWORD),
        enabled=True,
        phone=data.get("phone") or "",
        email=data.get("email") or "",
        gender=data.get("gender") or "",
        description=data.get("description") or "",
        avatar=data.get("avatar") or "",
        dept_code=data.get("deptCode") or "",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_dict(user)


def update_user(db: Session, data: dict) -> dict:
    user = db.query(User).filter(User.id == data["id"]).first()
    if not user:
        raise BizError("用户不存在")
    if "username" in data and data["username"] != user.username:
        if db.query(User).filter(User.username == data["username"]).first():
            raise BizError("用户名已存在")
        user.username = data["username"]
    if "name" in data:
        user.name = data["name"]
    if "nickname" in data and data["nickname"] is not None:
        user.nickname = data["nickname"]
    if "role" in data:
        if not get_role_by_code(db, data["role"]):
            raise BizError("角色不存在")
        user.role_code = data["role"]
    for field, attr in (
        ("phone", "phone"),
        ("email", "email"),
        ("gender", "gender"),
        ("description", "description"),
        ("avatar", "avatar"),
    ):
        if field in data and data[field] is not None:
            setattr(user, attr, data[field])
    if "deptCode" in data:
        user.dept_code = data.get("deptCode") or ""
    db.commit()
    db.refresh(user)
    return _user_dict(user)


_GENDER_MAP = {
    "男": "male", "女": "female", "保密": "unknown",
    "male": "male", "female": "female", "unknown": "unknown",
}


def _normalize_gender(value: str) -> str:
    if not value:
        return ""
    gender = _GENDER_MAP.get(value.strip())
    if not gender:
        raise BizError("性别无效，请填写：男/女/保密")
    return gender


def import_users(db: Session, rows: list) -> dict:
    from app.core.data_scope import DEPARTMENTS

    if not rows:
        raise BizError("导入数据为空")
    valid_depts = {d["code"] for d in DEPARTMENTS}
    seen_usernames: set[str] = set()
    new_items = []
    skipped = 0
    for idx, row in enumerate(rows, start=2):
        data = dict(row)
        username = (data.get("username") or "").strip()
        name = (data.get("name") or "").strip()
        role = (data.get("role") or "").strip()
        if not username or not name or not role:
            raise BizError(f"第 {idx} 行：账号、真实姓名、角色编码为必填项")
        if username in seen_usernames or db.query(User).filter(User.username == username).first():
            skipped += 1
            continue
        if not get_role_by_code(db, role):
            raise BizError(f"第 {idx} 行：角色编码 {role} 不存在")
        phone = (data.get("phone") or "").strip()
        if phone and (len(phone) != 11 or not phone.isdigit() or phone[0] != "1"):
            raise BizError(f"第 {idx} 行：手机号格式无效")
        email = (data.get("email") or "").strip()
        if email and "@" not in email:
            raise BizError(f"第 {idx} 行：邮箱格式无效")
        gender = _normalize_gender(data.get("gender") or "")
        dept_code = (data.get("deptCode") or "").strip()
        if dept_code and dept_code not in valid_depts:
            raise BizError(f"第 {idx} 行：部门编码 {dept_code} 不存在")
        user = User(
            username=username,
            name=name,
            nickname=(data.get("nickname") or "").strip(),
            role_code=role,
            password_hash=hash_password(DEFAULT_PASSWORD),
            enabled=True,
            phone=phone,
            email=email,
            gender=gender,
            description=(data.get("description") or "").strip(),
            avatar="",
            dept_code=dept_code,
        )
        db.add(user)
        seen_usernames.add(username)
        new_items.append(user)
    db.commit()
    for user in new_items:
        db.refresh(user)
    return {
        "count": len(new_items),
        "skipped": skipped,
        "list": [_user_dict(u) for u in new_items],
    }


def delete_user(db: Session, user_id: int) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BizError("用户不存在")
    if user.role_code == "admin":
        raise BizError("不能删除管理员")
    db.delete(user)
    db.commit()
    return {"success": True}


def reset_user_password(db: Session, user_id: int) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BizError("用户不存在")
    user.password_hash = hash_password(DEFAULT_PASSWORD)
    db.commit()
    return {"success": True, "message": "密码已重置为 123456"}


def toggle_user_enabled(db: Session, user_id: int, enabled: bool) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise BizError("用户不存在")
    user.enabled = enabled
    db.commit()
    db.refresh(user)
    return _user_dict(user)
