import pytest

import traceframe_worker.ingestion as ingestion
from traceframe_worker.ingestion import derive_observations, normalise_source


def test_create_minio_client_configures_r2_region(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    sentinel = object()

    def fake_minio(endpoint: str, **options: object) -> object:
        captured["endpoint"] = endpoint
        captured.update(options)
        return sentinel

    monkeypatch.setattr(ingestion, "Minio", fake_minio)

    client = ingestion.create_minio_client(
        "https://account.r2.cloudflarestorage.com", "access-key", "secret-key", "auto"
    )

    assert client is sentinel
    assert captured == {
        "endpoint": "account.r2.cloudflarestorage.com",
        "access_key": "access-key",
        "secret_key": "secret-key",
        "secure": True,
        "region": "auto",
    }


def test_normalise_json_is_deterministic() -> None:
    result = normalise_source(b'{"z": 2, "a": 1}', "application/json")

    assert result == '{\n  "a": 1,\n  "z": 2\n}'


def test_derive_observations_counts_valid_indicators() -> None:
    synthetic_hash = "a" * 64
    result = derive_observations(
        "analyst@example.test saw 192.0.2.4 and https://example.test/path. "
        f"Repeat 192.0.2.4; hash {synthetic_hash}; ignore 999.0.0.1."
    )

    assert ("email", "analyst@example.test", 1) in result
    assert ("domain", "example.test", 2) in result
    assert ("ipv4", "192.0.2.4", 2) in result
    assert ("sha256", synthetic_hash, 1) in result
    assert ("url", "https://example.test/path", 1) in result
    assert all(value != "999.0.0.1" for _, value, _ in result)


def test_derive_observations_rejects_partial_sha256_values() -> None:
    too_short = "b" * 63
    embedded = "c" * 65

    result = derive_observations(f"{too_short} {embedded}")

    assert all(kind != "sha256" for kind, _, _ in result)
