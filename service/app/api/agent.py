from fastapi import APIRouter, Depends

from app.agents.assistant import chat
from app.core.deps import get_current_user
from app.core.response import ok
from app.db.models import User
from app.schemas.common import ChatRequest

router = APIRouter(prefix="/agent", tags=["AI 智能体"])


@router.post("/chat")
async def agent_chat(body: ChatRequest, _: User = Depends(get_current_user)):
    result = await chat(body.message, body.context)
    return ok(result)
