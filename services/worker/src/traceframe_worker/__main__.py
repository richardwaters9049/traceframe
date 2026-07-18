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


def main() -> None:
    settings = Settings()  # type: ignore[call-arg]
    database_url = str(settings.database_url)

    wait_for_database(database_url)
    logger.info("worker_ready pid=%s", os.getpid())

    while True:
        READY_FILE.touch()
        time.sleep(settings.poll_interval_seconds)


if __name__ == "__main__":
    main()
