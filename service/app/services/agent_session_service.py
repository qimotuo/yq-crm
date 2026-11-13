"""智脑中枢会话与消息持久化"""

import json
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.assistant import chat, stream_chat
from app.core.exceptions import BizError
from app.db.models import AgentMessage, AgentSession

WELCOME = (
    "你好，我是智脑中枢 · CRM 认知助手。"
    "可解读客户、工单、财务与安装全流程，并结合业务上下文给出建议。"
)
MAX_HISTORY = 20


def _fmt_dt(dt: datetime | None) -> str:
    if not dt:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M")


def _message_dict(msg: AgentMessage) -> dict:
    return {
        "id": msg.id,
        "role": msg.role,
        "content": msg.content,
        "thinking": msg.thinking or "",
        "model": msg.model or None,
        "tokens": msg.tokens,
        "createTime": _fmt_dt(msg.created_at),
    }


def _session_brief(row: AgentSession) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "updatedAt": _fmt_dt(row.updated_at),
    }


def _get_owned_session(db: Session, user_id: int, session_id: int) -> AgentSession:
    row = db.query(AgentSession).filter(
        AgentSession.id == session_id,
        AgentSession.user_id == user_id,
    ).first()
    if not row:
        raise BizError("会话不存在")
    return row


def _prepare_user_message(
    db: Session,
    row: AgentSession,
    existing: list[AgentMessage],
    message: str,
    context: dict | None,
) -> tuple[str, list[dict], int]:
    user_text = message.strip()
    if not user_text:
        raise BizError("消息不能为空")

    merged_context = {**(row.context or {}), **(context or {})}
    row.context = merged_context

    next_seq = len(existing)
    db.add(AgentMessage(
        session_id=row.id,
        role="user",
        content=user_text,
        seq=next_seq,
    ))
    db.flush()

    if row.title == "新对话":
        row.title = user_text[:18] + ("…" if len(user_text) > 18 else "")

    history = [
        {"role": m.role, "content": m.content}
        for m in existing
        if m.role in ("user", "assistant")
    ][-MAX_HISTORY:]
    return user_text, history, next_seq + 1


def _save_assistant_message(
    db: Session,
    row: AgentSession,
    session_id: int,
    seq: int,
    content: str,
    thinking: str,
    model: str,
    tokens: int,
) -> None:
    db.add(AgentMessage(
        session_id=session_id,
        role="assistant",
        content=content,
        thinking=thinking,
        seq=seq,
        model=model,
        tokens=tokens,
    ))
    row.updated_at = datetime.now(timezone.utc)
    db.commit()


def list_sessions(db: Session, user_id: int) -> dict:
    rows = (
        db.query(AgentSession)
        .filter(AgentSession.user_id == user_id)
        .order_by(AgentSession.updated_at.desc(), AgentSession.id.desc())
        .all()
    )
    return {"list": [_session_brief(r) for r in rows], "total": len(rows)}


def get_session_detail(db: Session, user_id: int, session_id: int) -> dict:
    row = _get_owned_session(db, user_id, session_id)
    messages = (
        db.query(AgentMessage)
        .filter(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.seq.asc(), AgentMessage.id.asc())
        .all()
    )
    return {
        **_session_brief(row),
        "context": dict(row.context or {}),
        "messages": [_message_dict(m) for m in messages],
    }


def create_session(db: Session, user_id: int, context: dict | None = None) -> dict:
    row = AgentSession(user_id=user_id, title="新对话", context=context or {})
    db.add(row)
    db.flush()
    db.add(AgentMessage(
        session_id=row.id,
        role="assistant",
        content=WELCOME,
        seq=0,
        model="system",
    ))
    db.commit()
    db.refresh(row)
    return get_session_detail(db, user_id, row.id)


def delete_session(db: Session, user_id: int, session_id: int) -> bool:
    row = _get_owned_session(db, user_id, session_id)
    db.delete(row)
    db.commit()
    return True


async def send_message(
    db: Session,
    user_id: int,
    session_id: int,
    message: str,
    context: dict | None = None,
) -> dict:
    row = _get_owned_session(db, user_id, session_id)
    existing = (
        db.query(AgentMessage)
        .filter(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.seq.asc(), AgentMessage.id.asc())
        .all()
    )
    user_text, history, assistant_seq = _prepare_user_message(db, row, existing, message, context)
    db.commit()

    result = await chat(user_text, row.context, history)
    _save_assistant_message(
        db,
        row,
        session_id,
        assistant_seq,
        result["reply"],
        result.get("thinking") or "",
        result.get("model") or "",
        int(result.get("tokens") or 0),
    )

    detail = get_session_detail(db, user_id, session_id)
    return {**result, "session": detail}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def stream_send_message(
    db: Session,
    user_id: int,
    session_id: int,
    message: str,
    context: dict | None = None,
) -> Iterator[str]:
    row = _get_owned_session(db, user_id, session_id)
    existing = (
        db.query(AgentMessage)
        .filter(AgentMessage.session_id == session_id)
        .order_by(AgentMessage.seq.asc(), AgentMessage.id.asc())
        .all()
    )
    user_text, history, assistant_seq = _prepare_user_message(db, row, existing, message, context)
    db.commit()

    thinking_parts: list[str] = []
    content_parts: list[str] = []
    model = "demo-agent"
    tokens = 0

    try:
        for event in stream_chat(user_text, row.context, history):
            etype = event.get("type")
            if etype == "thinking":
                thinking_parts.append(event.get("content") or "")
                yield _sse({"type": "thinking", "content": event.get("content") or ""})
            elif etype == "content":
                content_parts.append(event.get("content") or "")
                yield _sse({"type": "content", "content": event.get("content") or ""})
            elif etype == "done":
                model = event.get("model") or model
                tokens = int(event.get("tokens") or 0)
                if event.get("thinking"):
                    thinking_parts = [event["thinking"]]
                if event.get("reply"):
                    content_parts = [event["reply"]]
    except Exception as exc:
        yield _sse({"type": "error", "message": str(exc)})
        return

    full_thinking = "".join(thinking_parts)
    full_content = "".join(content_parts)
    _save_assistant_message(db, row, session_id, assistant_seq, full_content, full_thinking, model, tokens)
    detail = get_session_detail(db, user_id, session_id)
    yield _sse({
        "type": "done",
        "model": model,
        "tokens": tokens,
        "thinking": full_thinking,
        "reply": full_content,
        "session": detail,
    })
