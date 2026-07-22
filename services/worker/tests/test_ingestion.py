from traceframe_worker.ingestion import derive_observations, normalise_source


def test_normalise_json_is_deterministic() -> None:
    result = normalise_source(b'{"z": 2, "a": 1}', "application/json")

    assert result == '{\n  "a": 1,\n  "z": 2\n}'


def test_derive_observations_counts_valid_indicators() -> None:
    result = derive_observations(
        "analyst@example.test saw 192.0.2.4 and https://example.test/path. "
        "Repeat 192.0.2.4; ignore 999.0.0.1."
    )

    assert ("email", "analyst@example.test", 1) in result
    assert ("domain", "example.test", 2) in result
    assert ("ipv4", "192.0.2.4", 2) in result
    assert ("url", "https://example.test/path", 1) in result
    assert all(value != "999.0.0.1" for _, value, _ in result)
