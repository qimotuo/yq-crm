"""按合同截止日期计算展示状态，用导入模板里的说法。"""

from __future__ import annotations

import re
from datetime import date

_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
_CANON = {
    "一个月到期": "30天后到期",
    "30天到期": "30天后到期",
    "30天后到期": "30天后到期",
    "即将到期": "30天后到期",
    "10天到期": "10天后到期",
    "10天后到期": "10天后到期",
    "三天到期": "3天后到期",
    "3天到期": "3天后到期",
    "3天后到期": "3天后到期",
    "已到期": "已逾期",
    "已逾期": "已逾期",
    "正常": "正常",
}


def parse_end_date(text: str) -> date | None:
    raw = (text or "").strip()
    if not raw:
        return None
    if "至" in raw:
        raw = raw.split("至", 1)[1]
    matched = _DATE.search(raw)
    if not matched:
        return None
    try:
        return date.fromisoformat(matched.group(0))
    except ValueError:
        return None


def canon_contract_status(status: str) -> str:
    raw = (status or "").strip()
    if raw == "待生成":
        return raw
    return _CANON.get(raw, raw or "正常")


def resolve_contract_status(end_text: str, status: str = "", *, keep_pending: bool = True) -> str:
    """能解析截止日期时按剩余天数覆盖。合同列表里的「待生成」保持原样。"""
    raw = (status or "").strip()
    if keep_pending and raw == "待生成":
        return raw
    current = canon_contract_status(raw)
    end = parse_end_date(end_text)
    if not end:
        return current
    days = (end - date.today()).days
    if days < 0:
        return "已逾期"
    if days <= 3:
        return "3天后到期"
    if days <= 10:
        return "10天后到期"
    if days <= 30:
        return "30天后到期"
    return "正常"
