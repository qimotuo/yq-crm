from pydantic import BaseModel, Field


class ScheduleCreateRequest(BaseModel):
    title: str
    customerName: str
    date: str
    time: str = "09:00"
    type: str = "上门"


class NotificationReadRequest(BaseModel):
    id: int | None = None


class AdminNotificationSendRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=64)
    content: str = Field(..., min_length=1, max_length=200)
    type: str = "系统"
    path: str = ""
    targetType: str = Field(..., pattern="^(all|roles|users)$")
    roleCodes: list[str] = Field(default_factory=list)
    userIds: list[int] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=lambda: ["site"])
