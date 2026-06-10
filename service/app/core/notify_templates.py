"""站内消息通知模板 — 统一注册，业务侧按 code 调用即可扩展。"""

from typing import Any

# code -> 模板定义（title/content 支持 {field} 占位）
NOTIFY_TEMPLATES: dict[str, dict[str, Any]] = {
    "schedule_reminder": {
        "type": "日程",
        "title": "今日日程提醒",
        "content": "{time} {title}（{customer_name}）",
        "path": "/schedules",
    },
    "schedule_created": {
        "type": "日程",
        "title": "日程已创建",
        "content": "{date} {time} {title}，客户：{customer_name}",
        "path": "/schedules",
    },
    "workorder_created": {
        "type": "工单",
        "title": "工单已创建",
        "content": "工单 {order_no}（{customer_name}）待派工",
        "path": "/dispatch",
    },
    "workorder_dispatch": {
        "type": "工单",
        "title": "新派工任务",
        "content": "工单 {order_no} 已派给 {installer}，请安排安装",
        "path": "/install-register",
    },
    "workorder_install": {
        "type": "工单",
        "title": "安装登记完成",
        "content": "工单 {order_no} 已完成安装登记",
        "path": "/work-orders",
    },
    "workorder_pending_dispatch": {
        "type": "工单",
        "title": "待派工提醒",
        "content": "{count} 个工单等待派工",
        "path": "/dispatch",
    },
    "finance_overdue": {
        "type": "财务",
        "title": "回款逾期提醒",
        "content": "{customer_name} 账单已逾期，未收 ¥{amount}",
        "path": "/finance",
    },
    "stock_low": {
        "type": "库存",
        "title": "库存预警",
        "content": "{item_name} 库存仅剩 {count}",
        "path": "/stock",
    },
    "contract_expire": {
        "type": "合同",
        "title": "合同即将到期",
        "content": "{customer_name} 合同将于 {days} 天内到期",
        "path": "/contracts",
    },
    "system_notice": {
        "type": "系统",
        "title": "{title}",
        "content": "{content}",
        "path": "{path}",
    },
}


MINIPROGRAM_TEMPLATES: dict[str, dict[str, Any]] = {
    "mp_workorder_dispatch": {
        "type": "工单",
        "title": "派工通知",
        "content": "您有新的安装任务：{{orderNo}}",
        "enabled": False,
    },
    "mp_payment_remind": {
        "type": "财务",
        "title": "回款提醒",
        "content": "{{customerName}} 账单待回款 ¥{{amount}}",
        "enabled": False,
    },
    "mp_schedule_remind": {
        "type": "日程",
        "title": "日程提醒",
        "content": "{{time}} {{title}}",
        "enabled": False,
    },
}


def list_site_templates() -> list[dict[str, Any]]:
    return [
        {
            "code": code,
            "type": tpl["type"],
            "title": tpl["title"],
            "content": tpl["content"],
            "path": tpl.get("path", ""),
            "enabled": True,
        }
        for code, tpl in NOTIFY_TEMPLATES.items()
    ]


def list_miniprogram_templates() -> list[dict[str, Any]]:
    return [
        {"code": code, **{k: v for k, v in tpl.items() if k != "enabled"}, "enabled": tpl.get("enabled", False)}
        for code, tpl in MINIPROGRAM_TEMPLATES.items()
    ]


def render_notify(template_code: str, context: dict[str, Any] | None = None) -> dict[str, str]:
    tpl = NOTIFY_TEMPLATES.get(template_code)
    if not tpl:
        raise ValueError(f"未知通知模板: {template_code}")
    ctx = context or {}
    safe = {k: str(v) for k, v in ctx.items()}

    def fmt(text: str) -> str:
        try:
            return text.format(**safe)
        except KeyError:
            return text

    return {
        "type": tpl["type"],
        "title": fmt(tpl["title"]),
        "content": fmt(tpl["content"]),
        "path": fmt(tpl.get("path", "")),
    }
