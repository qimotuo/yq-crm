from fastapi import APIRouter

from app.agents.assistant import chat
from app.core.response import ok
from app.schemas.common import ChatRequest

router = APIRouter(prefix="/agent", tags=["AI 智能体"])


@router.post("/chat")
async def agent_chat(body: ChatRequest):
    result = await chat(body.message, body.context)
    return ok(result)
