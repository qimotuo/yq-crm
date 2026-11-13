from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="用户输入")
    context: dict | None = Field(default=None, description="可选业务上下文，如 customerId、orderNo")


class SummarizeCustomerRequest(BaseModel):
    customerId: int = Field(..., gt=0, description="客户 ID")


class AgentSessionCreateRequest(BaseModel):
    context: dict | None = Field(default=None, description="可选业务上下文")


class AgentSessionChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: dict | None = Field(default=None, description="当前页面业务上下文")
