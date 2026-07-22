import pytest
from pydantic import ValidationError

from traceframe_worker.config import Settings


def test_settings_accept_valid_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://traceframe:secret@db:5432/traceframe")
    monkeypatch.setenv("POLL_INTERVAL_SECONDS", "2.5")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "traceframe")
    monkeypatch.setenv("MINIO_SECRET_KEY", "local-development-only")

    settings = Settings()  # type: ignore[call-arg]

    assert settings.poll_interval_seconds == 2.5


def test_settings_reject_invalid_poll_interval(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://traceframe:secret@db:5432/traceframe")
    monkeypatch.setenv("POLL_INTERVAL_SECONDS", "0")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "traceframe")
    monkeypatch.setenv("MINIO_SECRET_KEY", "local-development-only")

    with pytest.raises(ValidationError):
        Settings()  # type: ignore[call-arg]
