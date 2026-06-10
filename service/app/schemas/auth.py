from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


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
    role: str


class UserUpdateRequest(BaseModel):
    id: int
    username: str | None = None
    name: str | None = None
    role: str | None = None


class UserToggleRequest(BaseModel):
    id: int
    enabled: bool


class UserIdRequest(BaseModel):
    id: int


class DeleteUserRequest(BaseModel):
    id: int
