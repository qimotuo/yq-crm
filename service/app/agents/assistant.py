"""AI 智能体模块 — 后续接入 LangChain / OpenAI 等"""


async def chat(message: str, context: dict | None = None) -> dict:
    # 练手阶段：规则回复，验证接口链路
    ctx = context or {}
    hints = []
    if ctx.get("orderNo"):
        hints.append(f"工单 {ctx['orderNo']}")
    if ctx.get("customerName"):
        hints.append(f"客户 {ctx['customerName']}")

    prefix = f"（上下文：{'、'.join(hints)}）" if hints else ""
    reply = (
        f"{prefix}收到：「{message}」。\n"
        "当前为 Demo 智能体，后续可在此接入 LangChain + 大模型，"
        "实现：客户跟进建议、工单摘要、公海分配策略等。"
    )
    return {"reply": reply.strip(), "model": "demo-agent", "tokens": 0}
