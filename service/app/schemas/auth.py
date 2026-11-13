from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class WechatCodeRequest(BaseModel):
    code: str = Field(..., min_length=1)


class RoleUpdateRequest(BaseModel):
    id: int
    name: str | None = None
    menuKeys: list[str] | None = None
    operations: list[str] | None = None
    dataScope: str | None = None
    enabled: bool | None = None


class RoleCreateRequest(BaseModel):
    name: str
    code: str
    menuKeys: list[str] = Field(default_factory=list)
    operations: list[str] = Field(default_factory=list)
    dataScope: str = "SELF"
    enabled: bool = True


class UserCreateRequest(BaseModel):
    username: str
    name: str
    nickname: str | None = None
    role: str
    phone: str | None = None
    email: str | None = None
    gender: str | None = None
    description: str | None = None
    avatar: str | None = None
    deptCode: str | None = None


class UserUpdateRequest(BaseModel):
    id: int
    username: str | None = None
    name: str | None = None
    nickname: str | None = None
    role: str | None = None
    phone: str | None = None
    email: str | None = None
    gender: str | None = None
    description: str | None = None
    avatar: str | None = None
    deptCode: str | None = None


class UserToggleRequest(BaseModel):
    id: int
    enabled: bool


class UserIdRequest(BaseModel):
    id: int


class DeleteUserRequest(BaseModel):
    id: int


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    nickname: str | None = None
    phone: str | None = None
    email: str | None = None
    gender: str | None = None
    description: str | None = None
    avatar: str | None = None


class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str = Field(..., min_length=6)


class UserImportRow(BaseModel):
    username: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    nickname: str = ""
    role: str = Field(..., min_length=1)
    deptCode: str = ""
    phone: str = ""
    email: str = ""
    gender: str = ""
    description: str = ""


class UserImportRequest(BaseModel):
    rows: list[UserImportRow] = Field(default_factory=list)
