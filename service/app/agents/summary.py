"""客户 AI 摘要 — Demo 规则引擎，后续可换大模型"""


def _fmt_money(amount) -> str:
    try:
        return f"¥{float(amount):,.0f}"
    except (TypeError, ValueError):
        return "¥0"


def build_customer_summary(customer: dict, follow_ups: list | None = None) -> dict:
    follow_ups = follow_ups or []
    sorted_follows = sorted(follow_ups, key=lambda f: f.get("createTime") or "", reverse=True)

    highlights: list[str] = []
    risks: list[str] = []
    actions: list[str] = []
    sources: list[str] = []

    name = customer.get("customerName") or "该客户"
    store = customer.get("storeName") or ""
    order_no = customer.get("orderNo") or ""
    install_date = customer.get("installDate") or ""
    mac = customer.get("mac") or ""

    if install_date and mac:
        device = f"{customer.get('deviceSupplier', '')} {customer.get('deviceModel', '')}".strip()
        highlights.append(f"已于 {install_date} 完成安装{('，设备 ' + device) if device else ''}，MAC {mac}")
        sources.append("客户档案")
    elif order_no:
        risks.append(f"工单 {order_no} 尚未完成安装登记")
        actions.append("跟进安装进度，确认派工与出库状态")
        sources.append("工单信息")

    last_pay_time = customer.get("lastPaymentTime") or ""
    last_pay_amount = customer.get("lastPaymentAmount") or 0
    if last_pay_time:
        highlights.append(f"最近回款 {last_pay_time}，金额 {_fmt_money(last_pay_amount)}")
        sources.append("财务记录")
    elif order_no:
        risks.append("暂无回款记录")
        actions.append("核对账单周期并安排回款跟进")

    status = customer.get("contactStatus") or ""
    if status == "待跟进":
        risks.append("联系状态为「待跟进」，需尽快触达")
        actions.append("今日安排电话或微信跟进")
    elif status == "中断合作":
        risks.append("客户已标记「中断合作」，注意续约风险")

    sales = customer.get("salesName") or ""
    if sales:
        highlights.append(f"经办销售：{sales}")

    if sorted_follows:
        latest = sorted_follows[0]
        content = (latest.get("content") or "")[:60]
        highlights.append(f"最近跟进（{latest.get('createTime', '-')}）：{content}")
        sources.append(f"跟进记录 ×{len(sorted_follows)}")
        pending = [f for f in sorted_follows if f.get("status") == "待完成"]
        if pending:
            plan = pending[0].get("nextPlan") or "待办跟进"
            actions.append(f"完成待办：{plan}")
    elif status != "中断合作":
        actions.append("建议补充跟进记录，便于后续协作")

    if risks and highlights:
        headline = f"{name}（{store}）合作中，有 {len(risks)} 项需关注。"
    elif risks:
        headline = f"{name}（{store}）存在待处理事项，建议优先跟进。"
    elif highlights:
        headline = f"{name}（{store}）整体状态良好。"
    else:
        headline = f"{name}（{store}）为新客户，基础信息待完善。"

    if not actions:
        actions.append("保持定期回访，关注合同到期与设备在线状态")

    return {
        "summary": headline,
        "highlights": highlights[:4],
        "risks": risks[:3],
        "actions": actions[:3],
        "sources": list(dict.fromkeys(sources)),
        "model": "demo-agent",
    }
