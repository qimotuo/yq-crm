"""通知扩展通道：站内信已落库后，可并行推阿里云短信等。

后续接入步骤：
1. .env 配置 ALIYUN_* 并设 ALIYUN_SMS_ENABLED=true
2. 实现 AliyunSmsChannel.send 内真实 SDK 调用
3. 模板 code → 阿里云模板号映射见 TEMPLATE_SMS_CODE
"""

from __future__ import annotations

import logging
from typing import Protocol

from app.core.config import settings
from app.db.models import User

logger = logging.getLogger(__name__)

# 站内模板 code → 阿里云短信模板号配置字段
TEMPLATE_SMS_CODE = {
    "finance_overdue": "aliyun_sms_template_finance",
    "finance_payment_due": "aliyun_sms_template_finance",
    "contract_expire": "aliyun_sms_template_contract",
    "stock_low": "aliyun_sms_template_stock",
}


class NotifyChannel(Protocol):
    name: str

    def send(
        self,
        *,
        user: User,
        template_code: str,
        title: str,
        content: str,
        context: dict | None = None,
    ) -> bool: ...


class AliyunSmsChannel:
    """阿里云短信通道桩：未启用时 no-op；启用后在此接 Dysmsapi。"""

    name = "aliyun_sms"

    def send(
        self,
        *,
        user: User,
        template_code: str,
        title: str,
        content: str,
        context: dict | None = None,
    ) -> bool:
        if not settings.aliyun_sms_enabled:
            return False
        phone = (user.phone or "").strip()
        if not phone:
            logger.debug("阿里云短信跳过：用户 %s 无手机号", user.username)
            return False
        if not settings.aliyun_access_key_id or not settings.aliyun_access_key_secret:
            logger.warning("阿里云短信已启用但未配置 AccessKey，跳过发送")
            return False

        cfg_key = TEMPLATE_SMS_CODE.get(template_code)
        template_id = getattr(settings, cfg_key, "") if cfg_key else ""
        if not template_id:
            logger.debug("阿里云短信跳过：模板 %s 未映射短信模板号", template_code)
            return False

        # TODO: 接入阿里云 Dysmsapi
        # from alibabacloud_dysmsapi20170525.client import Client
        # client.send_sms(phone_numbers=phone, sign_name=settings.aliyun_sms_sign_name,
        #                 template_code=template_id, template_param=json.dumps(context or {}))
        logger.info(
            "[aliyun_sms stub] to=%s sign=%s tpl=%s title=%s ctx=%s",
            phone,
            settings.aliyun_sms_sign_name,
            template_id,
            title,
            context,
        )
        return True


def dispatch_extra_channels(
    *,
    user: User,
    template_code: str,
    title: str,
    content: str,
    context: dict | None = None,
) -> None:
    """站内信成功后调用；后续可在此追加钉钉/邮件等通道。"""
    channels: list[NotifyChannel] = [AliyunSmsChannel()]
    for ch in channels:
        try:
            ch.send(
                user=user,
                template_code=template_code,
                title=title,
                content=content,
                context=context,
            )
        except Exception:
            logger.exception("通知通道 %s 发送失败 user=%s", ch.name, user.id)
