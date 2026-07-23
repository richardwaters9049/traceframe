from pydantic import Field, HttpUrl, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from the container environment."""

    model_config = SettingsConfigDict(case_sensitive=False)

    database_url: PostgresDsn
    poll_interval_seconds: float = Field(default=5, gt=0, le=60)
    minio_endpoint: str = Field(default="http://minio:9000", min_length=3)
    minio_bucket: str = Field(default="case-source-material", min_length=3, max_length=63)
    minio_region: str = Field(default="us-east-1", min_length=2, max_length=32)
    minio_access_key: str = Field(min_length=3)
    minio_secret_key: str = Field(min_length=8)
    worker_id: str = Field(default="traceframe-worker", min_length=3, max_length=80)

    @field_validator("minio_endpoint", mode="before")
    @classmethod
    def normalise_minio_endpoint(cls, value: object) -> str:
        endpoint = str(value).strip()
        if not endpoint.startswith(("http://", "https://")):
            endpoint = f"http://{endpoint}"
        parsed = HttpUrl(endpoint)
        if parsed.path not in (None, "/") or parsed.query or parsed.fragment:
            raise ValueError("MinIO endpoint must not contain a path, query, or fragment")
        return str(parsed).rstrip("/")
