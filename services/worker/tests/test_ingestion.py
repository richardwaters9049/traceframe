from traceframe_worker.ingestion import derive_observations, normalise_source


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
