from unittest.mock import MagicMock

import traceframe_worker.source_disposal as disposal
from traceframe_worker.source_disposal import SourceDisposalJob


def source_job() -> SourceDisposalJob:
    return SourceDisposalJob(
        id="11111111-1111-4111-8111-111111111111",
        source_id="22222222-2222-4222-8222-222222222222",
        object_key="cases/case-id/sources/source-id",
        attempts=1,
        max_attempts=3,
    )


def test_process_disposal_removes_object_before_completion(monkeypatch) -> None:
    job = source_job()
    client = MagicMock()
    complete = MagicMock()
    fail = MagicMock()
    monkeypatch.setattr(disposal, "claim_disposal_job", MagicMock(return_value=job))
    monkeypatch.setattr(disposal, "complete_disposal", complete)
    monkeypatch.setattr(disposal, "fail_disposal", fail)

    result = disposal.process_one_disposal_job(
        "postgresql://traceframe:secret@db/traceframe",
        client,
        "case-source-material",
        "worker-one",
    )

    assert result == job
    client.remove_object.assert_called_once_with("case-source-material", job.object_key)
    complete.assert_called_once_with(
        "postgresql://traceframe:secret@db/traceframe",
        job,
    )
    fail.assert_not_called()


def test_process_disposal_records_storage_failure(monkeypatch) -> None:
    job = source_job()
    error = RuntimeError("synthetic storage failure")
    client = MagicMock()
    client.remove_object.side_effect = error
    complete = MagicMock()
    fail = MagicMock()
    monkeypatch.setattr(disposal, "claim_disposal_job", MagicMock(return_value=job))
    monkeypatch.setattr(disposal, "complete_disposal", complete)
    monkeypatch.setattr(disposal, "fail_disposal", fail)

    result = disposal.process_one_disposal_job(
        "postgresql://traceframe:secret@db/traceframe",
        client,
        "case-source-material",
        "worker-one",
    )

    assert result == job
    complete.assert_not_called()
    fail.assert_called_once_with(
        "postgresql://traceframe:secret@db/traceframe",
        job,
        error,
    )
