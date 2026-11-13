from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.agents.assistant import chat, summarize_customer
from app.core.data_scope import assert_customer_access
from app.core.deps import get_current_permissions, get_current_user
from app.core.response import ok
from app.db.models import User
from app.db.session import get_db
from app.schemas.common import (
    AgentSessionChatRequest,
    AgentSessionCreateRequest,
    ChatRequest,
    SummarizeCustomerRequest,
)
from app.services import agent_session_service as session_svc
from app.services import customer_service as customer_svc
from app.services import follow_up_service as follow_svc

router = APIRouter(prefix="/agent", tags=["AI 智能体"])


@router.get("/sessions")
def list_agent_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ok(session_svc.list_sessions(db, user.id))


@router.post("/sessions")
def create_agent_session(
    body: AgentSessionCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = session_svc.create_session(db, user.id, body.context)
    return ok(item)


@router.get("/sessions/{session_id}")
def get_agent_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ok(session_svc.get_session_detail(db, user.id, session_id))


@router.delete("/sessions/{session_id}")
def delete_agent_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session_svc.delete_session(db, user.id, session_id)
    return ok(True)


@router.post("/sessions/{session_id}/chat/stream")
def agent_session_chat_stream(
    session_id: int,
    body: AgentSessionChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    gen = session_svc.stream_send_message(db, user.id, session_id, body.message, body.context)
    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/sessions/{session_id}/chat")
async def agent_session_chat(
    session_id: int,
    body: AgentSessionChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await session_svc.send_message(db, user.id, session_id, body.message, body.context)
    return ok(result)


@router.post("/chat")
async def agent_chat(body: ChatRequest, _: User = Depends(get_current_user)):
    result = await chat(body.message, body.context)
    return ok(result)


@router.post("/summarize-customer")
async def agent_summarize_customer(
    body: SummarizeCustomerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    customer = customer_svc.get_customer(db, body.customerId)
    assert_customer_access(customer, user, perms, db)
    follow_res = follow_svc.list_follow_ups(db, user, body.customerId, "", "", "", "", perms)
    result = await summarize_customer(customer, follow_res.get("list") or [])
    return ok(result)
