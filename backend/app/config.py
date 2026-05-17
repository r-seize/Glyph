from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List
import os


class Settings(BaseSettings):
    # Database
    database_url: str = Field(default=..., validation_alias="DATABASE_URL")

    # Security
    secret_key: str                   = Field(default=..., validation_alias="SECRET_KEY")
    jwt_algorithm: str                = "HS256"
    access_token_expire_minutes: int  = 60 * 24 * 7  # 7 days

    # Meilisearch
    meilisearch_url: str  = Field(default=..., validation_alias="MEILISEARCH_URL")
    meilisearch_key: str  = Field(default=..., validation_alias="MEILISEARCH_KEY")

    # GitHub OAuth - optional
    github_client_id: str      = ""
    github_client_secret: str  = ""
    github_api_url: str        = "https://api.github.com"
    github_oauth_url: str      = "https://github.com/login/oauth"

    # GitLab OAuth - optional
    gitlab_client_id: str      = ""
    gitlab_client_secret: str  = ""
    gitlab_api_url: str        = "https://gitlab.com/api/v4"
    gitlab_oauth_url: str      = "https://gitlab.com/oauth"

    # Public backend URL (used for OAuth redirect URIs)
    app_url: str = "http://localhost:8000"

    # Email - SMTP
    smtp_host: str      = ""
    smtp_port: int      = 587
    smtp_user: str      = ""
    smtp_password: str  = ""

    # Email - SendGrid
    sendgrid_api_key: str = ""

    # Email - Mailgun
    mailgun_api_key: str  = ""
    mailgun_domain: str   = ""

    # Email - Resend
    resend_api_key: str = ""

    # Shared from address
    email_from: str = "noreply@glyph.app"

    # Storage
    data_dir: str = "./data"

    # App
    frontend_url: str        = "http://localhost:3000"
    cors_origins: List[str]  = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @property
    def repos_dir(self) -> str:
        return os.path.join(self.data_dir, "repos")

    @property
    def docs_dir(self) -> str:
        return os.path.join(self.data_dir, "docs")

    @property
    def cache_dir(self) -> str:
        return os.path.join(self.data_dir, "cache")

    model_config = {
        "env_file": (".env", "../.env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True,
    }


settings = Settings()