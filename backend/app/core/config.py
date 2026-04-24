from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "השכרת רכבים"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Auth / JWT ────────────────────────────────────────────────────────────
    SECRET_KEY: str                          # openssl rand -hex 32
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480   # 8 שעות

    # ── Email (SMTP) ──────────────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM: str = "noreply@carrental.co.il"
    EMAILS_FROM_NAME: str = "השכרת רכבים"
    EMAILS_ENABLED: bool = False             # False = לא שולח אימיילים

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
