import hashlib

import httpx

from app.core.config import settings
from app.core.exceptions import BizError


def code_to_openid(code: str) -> str:
    if not code.strip():
        raise BizError("微信 code 无效")
    if settings.wechat_app_id and settings.wechat_app_secret:
        try:
            resp = httpx.get(
                "https://api.weixin.qq.com/sns/jscode2session",
                params={
                    "appid": settings.wechat_app_id,
                    "secret": settings.wechat_app_secret,
                    "js_code": code,
                    "grant_type": "authorization_code",
                },
                timeout=10,
            )
            data = resp.json()
        except httpx.HTTPError as exc:
            raise BizError("微信服务暂不可用") from exc
        if data.get("errcode"):
            raise BizError(f"微信登录失败：{data.get('errmsg', '未知错误')}")
        openid = data.get("openid")
        if not openid:
            raise BizError("微信登录失败：未获取 openid")
        return openid
    if not settings.wechat_mock:
        raise BizError("未配置微信小程序 AppID/Secret")
    return f"mock_{hashlib.sha256(code.encode()).hexdigest()[:24]}"
