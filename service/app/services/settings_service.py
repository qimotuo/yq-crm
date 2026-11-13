"""应用级键值配置。"""

from sqlalchemy.orm import Session

from app.db.models import AppSetting

DEFAULT_CTI_CONFIG = {
    "mode": "softphone",  # softphone | tel | webhook
    "autoOpenTel": False,
    "webhookUrl": "",
    "webhookToken": "",
    "providerName": "",
}

DEFAULT_SERVICE_ORDER_PRINT = {
    "title": "基米网安装服务单",
    "companyName": "基米网",
    "showStatus": True,
    "showCustomer": True,
    "showStore": True,
    "showAddress": True,
    "showContact": True,
    "showPhone": True,
    "showInstallDate": True,
    "showSales": True,
    "showInstaller": True,
    "showRemark": True,
    "showDevice": True,
    "showSignature": True,
    "footerLeft": "客户签字：____________",
    "footerCenter": "安装人员签字：____________",
    "footerRight": "日期：____________",
    "extraNote": "",
}

DEFAULT_STOCK_CONFIG = {
    "lowThreshold": 5,
}


def get_setting(db: Session, key: str, default: dict | None = None) -> dict:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        return dict(default or {})
    return {**(default or {}), **(row.value or {})}


def put_setting(db: Session, key: str, value: dict, default: dict | None = None) -> dict:
    merged = {**(default or {}), **(value or {})}
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = merged
    else:
        row = AppSetting(key=key, value=merged)
        db.add(row)
    db.commit()
    db.refresh(row)
    return dict(row.value or {})


def get_cti_config(db: Session) -> dict:
    return get_setting(db, "cti_config", DEFAULT_CTI_CONFIG)


def update_cti_config(db: Session, body: dict) -> dict:
    allowed = set(DEFAULT_CTI_CONFIG.keys())
    patch = {k: body[k] for k in body if k in allowed}
    if "mode" in patch and patch["mode"] not in ("softphone", "tel", "webhook"):
        from app.core.exceptions import BizError
        raise BizError("CTI 模式仅支持 softphone / tel / webhook")
    return put_setting(db, "cti_config", {**get_cti_config(db), **patch}, DEFAULT_CTI_CONFIG)


def get_service_order_print(db: Session) -> dict:
    return get_setting(db, "print_service_order", DEFAULT_SERVICE_ORDER_PRINT)


def update_service_order_print(db: Session, body: dict) -> dict:
    allowed = set(DEFAULT_SERVICE_ORDER_PRINT.keys())
    patch = {k: body[k] for k in body if k in allowed}
    return put_setting(
        db, "print_service_order",
        {**get_service_order_print(db), **patch},
        DEFAULT_SERVICE_ORDER_PRINT,
    )


def get_stock_config(db: Session) -> dict:
    from app.core.config import settings

    cfg = get_setting(db, "stock_config", DEFAULT_STOCK_CONFIG)
    # 若库中无配置，回落到环境变量默认值
    if not db.query(AppSetting).filter(AppSetting.key == "stock_config").first():
        cfg = {**cfg, "lowThreshold": int(settings.stock_low_threshold or 5)}
    return cfg


def update_stock_config(db: Session, body: dict) -> dict:
    from app.core.exceptions import BizError

    patch = {}
    if "lowThreshold" in body:
        try:
            thr = int(body["lowThreshold"])
        except (TypeError, ValueError) as exc:
            raise BizError("库存预警阈值必须是整数") from exc
        if thr < 0 or thr > 9999:
            raise BizError("库存预警阈值需在 0～9999")
        patch["lowThreshold"] = thr
    return put_setting(db, "stock_config", {**get_stock_config(db), **patch}, DEFAULT_STOCK_CONFIG)


def get_stock_low_threshold(db: Session) -> int:
    return max(0, int(get_stock_config(db).get("lowThreshold") or 5))
