from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "השכרת רכבים"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Auth / JWT ────────────────────────────────────────────────────────────
    SECRET_KEY: str                          # openssl rand -hex 32
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480   # 8 שעות
    SUGGESTION_APPLY_TOKEN_EXPIRE_MINUTES: int = 15
    SUGGESTIONS_SEARCH_RATE_LIMIT_PER_MINUTE: int = 120
    SUGGESTIONS_APPLY_RATE_LIMIT_PER_MINUTE: int = 30
    SUGGESTIONS_RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_BUCKET_RETENTION_SECONDS: int = 300
    RATE_LIMIT_BACKEND: str = "memory"
    RATE_LIMIT_REDIS_URL: Optional[str] = None
    RATE_LIMIT_REDIS_KEY_PREFIX: str = "rate_limit"

    # ── Email (SMTP) ──────────────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM: str = "noreply@carrental.co.il"
    EMAILS_FROM_NAME: str = "השכרת רכבים"
    EMAILS_ENABLED: bool = False             # False = לא שולח אימיילים
    SECURITY_ALERT_RECIPIENTS: str = ""     # comma-separated recipient list

    # ── Google Drive (for car photos) ──────────────────────────────────────────
    GOOGLE_DRIVE_FOLDER_ID: Optional[str] = None  # Folder ID in Google Drive
    GOOGLE_DRIVE_CREDENTIALS_JSON: Optional[str] = None  # Service account JSON (base64 or path)
    GOOGLE_DRIVE_ENABLED: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
