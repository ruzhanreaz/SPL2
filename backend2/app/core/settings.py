from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="Backend2 API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")

    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/lab_analytics",
        alias="DATABASE_URL",
    )

    max_upload_mb: int = Field(default=10, alias="MAX_UPLOAD_MB")
    tesseract_cmd: str | None = Field(default=None, alias="TESSERACT_CMD")
    reports_drive_path: str | None = Field(default=None, alias="REPORTS_DRIVE_PATH")
    minio_endpoint: str = Field(default="http://localhost:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="vitabridge-documents", alias="MINIO_BUCKET")
    cors_allow_origins: str = Field(
        default="http://localhost:5173,http://localhost:5174",
        alias="CORS_ALLOW_ORIGINS",
    )
    ai_conversation_ollama_url: str = Field(
        default="http://127.0.0.1:11434/api/chat",
        alias="AI_CONVERSATION_OLLAMA_URL",
    )
    ai_conversation_ollama_model: str = Field(
        default="llama3:8b",
        alias="AI_CONVERSATION_OLLAMA_MODEL",
    )
    ai_conversation_provider: str = Field(
        default="ollama",
        alias="AI_CONVERSATION_PROVIDER",
    )
    ai_conversation_groq_api_key: str | None = Field(
        default=None,
        alias="AI_CONVERSATION_GROQ_API_KEY",
    )
    ai_conversation_groq_model: str = Field(
        default="llama-3.3-70b-versatile",
        alias="AI_CONVERSATION_GROQ_MODEL",
    )
    ai_conversation_groq_base_url: str = Field(
        default="https://api.groq.com/openai/v1",
        alias="AI_CONVERSATION_GROQ_BASE_URL",
    )
    ai_conversation_system_prompt_path: str = Field(
        default="../ai/SYSTEM_PROMPT.txt",
        alias="AI_CONVERSATION_SYSTEM_PROMPT_PATH",
    )
    ai_conversation_timeout_seconds: float = Field(
        default=25.0,
        alias="AI_CONVERSATION_TIMEOUT_SECONDS",
    )
    app_backend_url: str = Field(
        default="http://127.0.0.1:8080",
        alias="APP_BACKEND_URL",
    )
    ai_doctor_public_doctors_url: str | None = Field(
        default=None,
        alias="AI_DOCTOR_PUBLIC_DOCTORS_URL",
    )
    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    llm_openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    llm_openai_base_url: str = Field(
        default="https://api.openai.com/v1",
        alias="OPENAI_BASE_URL",
    )
    llm_openai_model: str = Field(
        default="gpt-4o-mini",
        alias="OPENAI_MODEL",
    )
    llm_anthropic_api_key: str | None = Field(
        default=None,
        alias="ANTHROPIC_API_KEY",
    )
    llm_anthropic_base_url: str = Field(
        default="https://api.anthropic.com/v1",
        alias="ANTHROPIC_BASE_URL",
    )
    llm_anthropic_model: str = Field(
        default="claude-3-5-sonnet-latest",
        alias="ANTHROPIC_MODEL",
    )
    llm_gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    llm_gemini_base_url: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta",
        alias="GEMINI_BASE_URL",
    )
    llm_gemini_model: str = Field(
        default="gemini-1.5-flash",
        alias="GEMINI_MODEL",
    )
    triage_timeout_seconds: float = Field(
        default=20.0,
        alias="TRIAGE_TIMEOUT_SECONDS",
    )
    triage_confidence_threshold: float = Field(
        default=0.6,
        alias="TRIAGE_CONFIDENCE_THRESHOLD",
    )
    triage_requests_per_minute: int = Field(
        default=60,
        alias="TRIAGE_REQUESTS_PER_MINUTE",
    )

    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allow_origins.split(",")
            if origin.strip()
        ]

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
