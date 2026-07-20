import logging
import os
import time
from pathlib import Path

import psycopg

from traceframe_worker.config import Settings

READY_FILE = Path("/tmp/traceframe-worker-ready")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s level=%(levelname)s service=worker message=%(message)s",
)
logger = logging.getLogger("traceframe.worker")
SESSION_CLEANUP_INTERVAL_SECONDS = 60 * 60


def wait_for_database(database_url: str) -> None:
    """Wait until PostgreSQL accepts a simple query."""

    while True:
        try:
            with psycopg.connect(database_url, connect_timeout=5) as connection:
                connection.execute("SELECT 1")
            return
        except psycopg.Error as error:
            logger.warning("database_unavailable error=%s", error.__class__.__name__)
            time.sleep(2)


def cleanup_expired_sessions(database_url: str) -> int:
    """Delete expired server-side sessions and return the affected row count."""

    with psycopg.connect(database_url, connect_timeout=5) as connection:
        result = connection.execute(
            "DELETE FROM sessions WHERE expires_at <= now() RETURNING id"
        )
        return result.rowcount or 0


def main() -> None:
    settings = Settings()  # type: ignore[call-arg]
    database_url = str(settings.database_url)

    wait_for_database(database_url)
    logger.info("worker_ready pid=%s", os.getpid())

    last_cleanup: float | None = None
    while True:
        current_time = time.monotonic()
        if last_cleanup is None or current_time - last_cleanup >= SESSION_CLEANUP_INTERVAL_SECONDS:
            deleted = cleanup_expired_sessions(database_url)
            logger.info("session_cleanup_complete deleted=%s", deleted)
            last_cleanup = current_time
        READY_FILE.touch()
        time.sleep(settings.poll_interval_seconds)


if __name__ == "__main__":
    main()
