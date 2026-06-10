from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="用户输入")
    context: dict | None = Field(default=None, description="可选业务上下文，如 customerId、orderNo")
