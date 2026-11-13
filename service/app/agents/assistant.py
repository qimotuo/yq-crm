"""AI 智能体 — 百炼 DashScope（OpenAI 兼容），无 Key 时回退 Demo 规则"""

import time
from collections.abc import Iterator
from typing import Any

from openai import OpenAI

from app.agents.summary import build_customer_summary
from app.core.config import settings

_client: OpenAI | None = None

CRM_SYSTEM_PROMPT = """你是「智脑中枢」，宽带/物联网设备 CRM 的智能助手。
帮助销售、安装、财务人员理解客户状态、工单流程、回款与安装登记。
回答简洁实用，用中文，可分点说明。若上下文中有客户名、工单号，请结合回答。
不确定时说明可在系统哪个菜单查看，不要编造具体金额或日期。
深度思考时请用中文简要分析问题，再给出中文回答。"""


def _get_client() -> OpenAI | None:
    global _client
    api_key = settings.llm_api_key
    if not api_key:
        return None
    if _client is None:
        _client = OpenAI(api_key=api_key, base_url=settings.openai_base_url)
    return _client


def _context_user_hint(context: dict | None) -> str:
    ctx = context or {}
    parts = []
    if ctx.get("page"):
        parts.append(f"当前页面：{ctx['page']}")
    if ctx.get("customerName"):
        parts.append(f"客户：{ctx['customerName']}")
    if ctx.get("customerId"):
        parts.append(f"客户ID：{ctx['customerId']}")
    if ctx.get("orderNo"):
        parts.append(f"工单号：{ctx['orderNo']}")
    return "；".join(parts)


def _build_user_content(message: str, context: dict | None) -> str:
    user_content = message.strip()
    hint = _context_user_hint(context)
    if hint:
        user_content = f"[业务上下文：{hint}]\n\n{user_content}"
    return user_content


def _build_openai_messages(message: str, context: dict | None, history: list | None) -> list[dict]:
    openai_messages: list[dict] = [{"role": "system", "content": CRM_SYSTEM_PROMPT}]
    for item in history or []:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            openai_messages.append({"role": role, "content": content})
    openai_messages.append({"role": "user", "content": _build_user_content(message, context)})
    return openai_messages


def _demo_reply(message: str, context: dict | None = None) -> str:
    return _demo_chat(message, context)["reply"]


def _demo_thinking(message: str, context: dict | None = None) -> str:
    ctx = context or {}
    lines = ["【分析问题】", f"用户提问：{message.strip()}"]
    if ctx.get("customerName"):
        lines.append(f"关联客户：{ctx['customerName']}")
    if ctx.get("orderNo"):
        lines.append(f"关联工单：{ctx['orderNo']}")
    if ctx.get("page"):
        lines.append(f"当前页面：{ctx['page']}")
    if any(k in message for k in ("回款", "欠", "账单", "财务")):
        lines.append("意图识别：财务 / 回款相关查询")
        lines.append("检索方向：合作客户详情、财务板块、AI 摘要")
    elif any(k in message for k in ("跟进", "联系", "拜访")):
        lines.append("意图识别：销售跟进建议")
        lines.append("检索方向：跟进记录、客户详情、日程")
    elif any(k in message for k in ("安装", "派工", "MAC", "IMEI")):
        lines.append("意图识别：安装与设备流程")
        lines.append("检索方向：派工管理、安装登记、全链路追溯")
    else:
        lines.append("意图识别：通用 CRM 业务咨询")
    lines.append("准备组织简洁可执行的中文回答。")
    return "\n".join(lines)


def _demo_chat(message: str, context: dict | None = None) -> dict:
    ctx = context or {}
    page = ctx.get("page") or ""
    customer_name = ctx.get("customerName") or ""
    order_no = ctx.get("orderNo") or ""
    hints = []
    if customer_name:
        hints.append(f"客户 {customer_name}")
    if order_no:
        hints.append(f"工单 {order_no}")
    if page:
        hints.append(f"页面 {page}")

    prefix = f"（上下文：{'、'.join(hints)}）\n" if hints else ""
    msg = message.strip()

    if any(k in msg for k in ("回款", "欠", "账单", "财务")):
        if customer_name:
            reply = (
                f"{prefix}关于 **{customer_name}** 的财务情况：\n"
                "• 可在「合作客户」详情查看最近回款时间与金额\n"
                "• 财务板块支持按工单号查询账单与回款进度\n"
                "• 若存在逾期，建议优先电话确认付款计划"
            )
        else:
            reply = (
                f"{prefix}财务相关查询建议：\n"
                "• 打开「财务板块」按客户或工单筛选\n"
                "• 或在客户详情页查看 AI 摘要中的回款提示"
            )
    elif any(k in msg for k in ("跟进", "联系", "拜访")):
        reply = (
            f"{prefix}跟进建议：\n"
            "• 查看客户详情 AI 摘要中的「建议行动」\n"
            "• 在「我的客户」记录电话/微信/上门跟进\n"
            "• 有下次计划时系统可同步日程提醒"
        )
    elif any(k in msg for k in ("安装", "派工", "MAC", "IMEI")):
        reply = (
            f"{prefix}安装与设备：\n"
            "• 派工管理分配安装人员后，在安装登记页录入 MAC/IMEI/SIM\n"
            "• 全链路追溯支持按 MAC、工单号反查客户与合同"
        )
    elif any(k in msg for k in ("摘要", "分析", "怎么样", "情况")):
        if customer_name:
            reply = f"{prefix}正在查看 **{customer_name}**。请打开客户详情页，顶部「AI 智能摘要」卡片有自动生成的分析与建议。"
        else:
            reply = f"{prefix}打开任意客户详情页，可查看 AI 自动生成的客户摘要与风险提示。"
    else:
        reply = (
            f"{prefix}收到：「{msg}」。\n\n"
            "我是 CRM 智能助手，可以帮你：\n"
            "• 解读客户回款、安装、跟进状态\n"
            "• 指引派工、安装登记、财务录入等操作\n"
            "• 结合当前页面上下文给出建议\n\n"
            "试试问：「这个客户回款情况怎么样？」"
        )

    return {
        "reply": reply.strip(),
        "thinking": _demo_thinking(message, context),
        "model": "demo-agent",
        "tokens": 0,
    }


def _demo_stream_chat(message: str, context: dict | None = None) -> Iterator[dict[str, Any]]:
    thinking = _demo_thinking(message, context)
    reply = _demo_reply(message, context)
    for i, ch in enumerate(thinking):
        yield {"type": "thinking", "content": ch}
        if i % 3 == 0:
            time.sleep(0.012)
    for ch in reply:
        yield {"type": "content", "content": ch}
        time.sleep(0.018)
    yield {"type": "done", "model": "demo-agent", "tokens": 0, "thinking": thinking, "reply": reply}


async def chat(message: str, context: dict | None = None, history: list | None = None) -> dict:
    parts_thinking: list[str] = []
    parts_content: list[str] = []
    model = settings.agent_model
    for event in stream_chat(message, context, history):
        if event["type"] == "thinking":
            parts_thinking.append(event["content"])
        elif event["type"] == "content":
            parts_content.append(event["content"])
        elif event["type"] == "done":
            model = event.get("model") or model
    thinking = "".join(parts_thinking)
    reply = "".join(parts_content)
    if not reply and not thinking:
        return _demo_chat(message, context)
    return {
        "reply": reply,
        "thinking": thinking,
        "model": model,
        "tokens": 0,
    }


def stream_chat(message: str, context: dict | None = None, history: list | None = None) -> Iterator[dict[str, Any]]:
    client = _get_client()
    if not client:
        yield from _demo_stream_chat(message, context)
        return

    openai_messages = _build_openai_messages(message, context, history)
    extra: dict[str, Any] = {}
    if settings.agent_enable_thinking:
        extra["enable_thinking"] = True

    try:
        stream = client.chat.completions.create(
            model=settings.agent_model,
            messages=openai_messages,
            stream=True,
            extra_body=extra or None,
        )
        thinking_parts: list[str] = []
        content_parts: list[str] = []
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            reasoning = getattr(delta, "reasoning_content", None)
            if reasoning:
                thinking_parts.append(reasoning)
                yield {"type": "thinking", "content": reasoning}
            content = getattr(delta, "content", None)
            if content:
                content_parts.append(content)
                yield {"type": "content", "content": content}
        yield {
            "type": "done",
            "model": settings.agent_model,
            "tokens": 0,
            "thinking": "".join(thinking_parts),
            "reply": "".join(content_parts),
        }
    except Exception as e:
        fallback = _demo_chat(message, context)
        thinking = fallback.get("thinking") or _demo_thinking(message, context)
        reply = f"大模型调用失败（{e}），以下为本地提示：\n\n{fallback['reply']}"
        for ch in thinking:
            yield {"type": "thinking", "content": ch}
            time.sleep(0.008)
        for ch in reply:
            yield {"type": "content", "content": ch}
            time.sleep(0.012)
        yield {
            "type": "done",
            "model": "demo-agent",
            "tokens": 0,
            "thinking": thinking,
            "reply": reply,
        }


async def summarize_customer(customer: dict, follow_ups: list | None = None) -> dict:
    return build_customer_summary(customer, follow_ups)
