from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from the container environment."""

    model_config = SettingsConfigDict(case_sensitive=False)

    database_url: PostgresDsn
    poll_interval_seconds: float = Field(default=5, gt=0, le=60)

