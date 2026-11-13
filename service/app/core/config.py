from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "宽带业务 CRM API"
    api_prefix: str = "/api"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    database_url: str = "postgresql://user:password@localhost:5432/yq_crm"
    jwt_secret_key: str = "yq-crm-jwt-secret-change-in-production"
    jwt_expire_minutes: int = 60 * 24 * 7

    wechat_app_id: str = ""
    wechat_app_secret: str = ""
    wechat_mock: bool = True

    openai_api_key: str = ""
    dashscope_api_key: str = ""
    openai_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    agent_model: str = "qwen-plus"
    agent_enable_thinking: bool = True

    # 本地附件目录（相对路径相对 service 工作目录；Docker 建议挂载绝对路径）
    upload_dir: str = "uploads"
    upload_max_mb: int = 10

    # 业务提醒阈值
    finance_due_days: int = 3          # 计划回款日前 N 天开始付费提醒
    contract_expire_days: int = 30     # 合同到期前 N 天提醒
    stock_low_threshold: int = 5       # 库存预警阈值

    # 阿里云短信（后续接入：填密钥并设 ALIYUN_SMS_ENABLED=true）
    aliyun_sms_enabled: bool = False
    aliyun_access_key_id: str = ""
    aliyun_access_key_secret: str = ""
    aliyun_sms_sign_name: str = ""
    aliyun_sms_template_finance: str = ""
    aliyun_sms_template_contract: str = ""
    aliyun_sms_template_stock: str = ""

    @property
    def llm_api_key(self) -> str:
        if "dashscope.aliyuncs.com" in self.openai_base_url and self.dashscope_api_key:
            return self.dashscope_api_key
        return self.openai_api_key


settings = Settings()
