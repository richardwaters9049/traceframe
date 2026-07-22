from pydantic import Field, HttpUrl, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from the container environment."""

    model_config = SettingsConfigDict(case_sensitive=False)

    database_url: PostgresDsn
    poll_interval_seconds: float = Field(default=5, gt=0, le=60)
    minio_endpoint: HttpUrl = HttpUrl("http://minio:9000")
    minio_bucket: str = Field(default="case-source-material", min_length=3, max_length=63)
    minio_access_key: str = Field(min_length=3)
    minio_secret_key: str = Field(min_length=8)
    worker_id: str = Field(default="traceframe-worker", min_length=3, max_length=80)
