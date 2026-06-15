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
    openai_base_url: str = "https://api.openai.com/v1"
    agent_model: str = "gpt-4o-mini"


settings = Settings()
