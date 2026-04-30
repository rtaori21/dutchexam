from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / "backend" / ".env", extra="ignore")

    # LLM
    llm_backend: str = "ollama"
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_model: str = "llama-3.3-70b-versatile"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_from: str = ""
    alert_to: str = ""

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # Scoring & schedule
    alert_min_score: int = 70
    scrape_interval_minutes: int = 30
    source_interval_minutes: int = 15

    # DB
    database_url: str = ""

    # LinkedIn
    linkedin_email: str = ""
    linkedin_password: str = ""
    auto_apply_enabled: bool = False

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite:///{(ROOT / 'data' / 'jobs.db').as_posix()}"

    @property
    def root(self) -> Path:
        return ROOT

    @property
    def config_dir(self) -> Path:
        return ROOT / "config"

    @property
    def resumes_dir(self) -> Path:
        return ROOT / "resumes"

    @property
    def data_dir(self) -> Path:
        return ROOT / "data"


settings = Settings()
