"""CTI 外呼：软电话条 + tel + webhook 厂商预留，通话记录落库。"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy.orm import Session

from app.core.exceptions import BizError
from app.db.models import CallLog, User
from app.services import settings_service

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_item(row: CallLog) -> dict:
    return {
        "id": row.id,
        "userId": row.user_id,
        "userName": row.user_name,
        "phone": row.phone,
        "customerId": row.customer_id,
        "customerName": row.customer_name,
        "direction": row.direction,
        "status": row.status,
        "duration": row.duration,
        "mode": row.mode,
        "providerRef": row.provider_ref,
        "remark": row.remark,
        "startedAt": row.started_at.strftime("%Y-%m-%d %H:%M:%S") if row.started_at else "",
        "endedAt": row.ended_at.strftime("%Y-%m-%d %H:%M:%S") if row.ended_at else "",
    }


def _invoke_webhook(config: dict, payload: dict) -> str:
    url = (config.get("webhookUrl") or "").strip()
    if not url:
        raise BizError("webhook 模式请先配置 CTI Webhook URL")
    headers = {"Content-Type": "application/json"}
    token = (config.get("webhookToken") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json() if resp.content else {}
            if isinstance(data, dict):
                return str(data.get("callId") or data.get("id") or data.get("ref") or "")
            return ""
    except BizError:
        raise
    except Exception as exc:
        logger.exception("CTI webhook 调用失败")
        raise BizError(f"CTI 外呼平台调用失败：{exc}") from exc


def start_call(db: Session, user: User, body: dict) -> dict:
    phone = str(body.get("phone") or "").strip()
    if not phone:
        raise BizError("请输入手机号")
    config = settings_service.get_cti_config(db)
    mode = config.get("mode") or "softphone"

    provider_ref = ""
    if mode == "webhook":
        provider_ref = _invoke_webhook(config, {
            "action": "dial",
            "phone": phone,
            "customerId": body.get("customerId"),
            "customerName": body.get("customerName") or "",
            "userId": user.id,
            "userName": user.name,
            "provider": config.get("providerName") or "",
        })

    row = CallLog(
        user_id=user.id,
        user_name=user.name,
        phone=phone,
        customer_id=body.get("customerId") or None,
        customer_name=body.get("customerName") or "",
        direction="outbound",
        status="calling",
        duration=0,
        mode=mode,
        provider_ref=provider_ref or "",
        remark=body.get("remark") or "",
        started_at=_now(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        **_to_item(row),
        "autoOpenTel": bool(config.get("autoOpenTel")) or mode == "tel",
        "mode": mode,
    }


def end_call(db: Session, user: User, body: dict) -> dict:
    call_id = body.get("id")
    if not call_id:
        raise BizError("缺少通话记录 id")
    row = db.query(CallLog).filter(CallLog.id == int(call_id)).first()
    if not row:
        raise BizError("通话记录不存在")
    if row.user_id != user.id and user.role_code != "admin":
        raise BizError("只能结束自己的通话")

    duration = int(body.get("duration") or 0)
    if duration < 0:
        duration = 0
    row.duration = duration
    row.status = body.get("status") or "ended"
    row.ended_at = _now()
    if body.get("remark"):
        row.remark = body["remark"]

    config = settings_service.get_cti_config(db)
    if row.mode == "webhook" and (config.get("webhookUrl") or "").strip():
        try:
            _invoke_webhook(config, {
                "action": "hangup",
                "callId": row.provider_ref or row.id,
                "phone": row.phone,
                "duration": duration,
                "userId": user.id,
            })
        except BizError:
            # 挂断失败不阻断落库
            logger.warning("CTI hangup webhook 失败 call_id=%s", row.id)

    db.commit()
    db.refresh(row)
    return _to_item(row)


def list_calls(
    db: Session,
    *,
    user: User,
    keyword: str = "",
    customer_id: int = 0,
    mine_only: bool = False,
    limit: int = 50,
) -> dict:
    q = db.query(CallLog)
    if mine_only or user.role_code != "admin":
        q = q.filter(CallLog.user_id == user.id)
    if customer_id:
        q = q.filter(CallLog.customer_id == customer_id)
    if keyword:
        kw = f"%{keyword.strip()}%"
        q = q.filter(
            (CallLog.phone.ilike(kw))
            | (CallLog.customer_name.ilike(kw))
            | (CallLog.user_name.ilike(kw))
        )
    rows = q.order_by(CallLog.started_at.desc()).limit(min(limit, 200)).all()
    return {"list": [_to_item(r) for r in rows], "total": len(rows)}
