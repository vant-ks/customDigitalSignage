"""
Application configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/vant_signage"

    # Auth
    secret_key: str = "change-me-to-a-64-char-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Rate limiting
    rate_limit_per_minute: int = 60

    # Provisioning
    provisioning_token_expire_hours: int = 24

    # Device heartbeat
    heartbeat_offline_threshold_seconds: int = 120

    # ── OAuth app credentials per storage provider ──────────────────────
    # Set these in .env or Railway environment variables.
    dropbox_client_id: str = ""
    dropbox_client_secret: str = ""

    gdrive_client_id: str = ""
    gdrive_client_secret: str = ""

    onedrive_client_id: str = ""
    onedrive_client_secret: str = ""

    # ── Local media storage (for direct uploads) ─────────────────────────
    local_media_dir: str = "/tmp/vant-media/uploads"
    thumbnail_dir: str = "/tmp/vant-media/thumbnails"

    # ── Frontend URL (used to build OAuth redirect URIs) ────────────────
    frontend_url: str = "http://localhost:3031"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
