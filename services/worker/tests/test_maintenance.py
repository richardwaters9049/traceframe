from unittest.mock import MagicMock

from traceframe_worker import __main__ as worker


def test_cleanup_expired_sessions_uses_database_time(monkeypatch) -> None:
    result = MagicMock(rowcount=3)
    connection = MagicMock()
    connection.execute.return_value = result
    context = MagicMock()
    context.__enter__.return_value = connection
    monkeypatch.setattr(worker.psycopg, "connect", MagicMock(return_value=context))

    deleted = worker.cleanup_expired_sessions("postgresql://traceframe:secret@db/traceframe")

    assert deleted == 3
    connection.execute.assert_called_once_with(
        "DELETE FROM sessions WHERE expires_at <= now() RETURNING id"
    )
