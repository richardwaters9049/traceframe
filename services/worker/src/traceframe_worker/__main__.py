import logging
import os
import time
from pathlib import Path

import psycopg

from traceframe_worker.config import Settings
from traceframe_worker.ingestion import create_minio_client, process_one_job, recover_stale_jobs
from traceframe_worker.source_disposal import (
    process_one_disposal_job,
    recover_stale_disposal_jobs,
)

READY_FILE = Path("/tmp/traceframe-worker-ready")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s level=%(levelname)s service=worker message=%(message)s",
)
logger = logging.getLogger("traceframe.worker")
SESSION_CLEANUP_INTERVAL_SECONDS = 60 * 60
HEARTBEAT_INTERVAL_SECONDS = 10


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
        result = connection.execute("DELETE FROM sessions WHERE expires_at <= now() RETURNING id")
        return result.rowcount or 0


def record_worker_heartbeat(database_url: str, worker_id: str) -> None:
    """Upsert a database-timestamped worker heartbeat."""

    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute(
            """
            INSERT INTO service_heartbeats (service_name, instance_id)
            VALUES ('worker', %s)
            ON CONFLICT (service_name, instance_id) DO UPDATE
            SET last_seen_at = now()
            """,
            (worker_id,),
        )


def main() -> None:
    settings = Settings()  # type: ignore[call-arg]
    database_url = str(settings.database_url)

    wait_for_database(database_url)
    minio_client = create_minio_client(
        str(settings.minio_endpoint),
        settings.minio_access_key,
        settings.minio_secret_key,
        settings.minio_region,
    )
    recovered = recover_stale_jobs(database_url)
    recovered_disposals = recover_stale_disposal_jobs(database_url)
    record_worker_heartbeat(database_url, settings.worker_id)
    logger.info("worker_ready pid=%s", os.getpid())
    if recovered:
        logger.warning("ingestion_leases_recovered count=%s", recovered)
    if recovered_disposals:
        logger.warning("source_disposal_leases_recovered count=%s", recovered_disposals)

    last_cleanup: float | None = None
    last_heartbeat = time.monotonic()
    while True:
        current_time = time.monotonic()
        if current_time - last_heartbeat >= HEARTBEAT_INTERVAL_SECONDS:
            record_worker_heartbeat(database_url, settings.worker_id)
            last_heartbeat = current_time
        if last_cleanup is None or current_time - last_cleanup >= SESSION_CLEANUP_INTERVAL_SECONDS:
            deleted = cleanup_expired_sessions(database_url)
            logger.info("session_cleanup_complete deleted=%s", deleted)
            last_cleanup = current_time
        disposal_job = process_one_disposal_job(
            database_url, minio_client, settings.minio_bucket, settings.worker_id
        )
        if disposal_job:
            logger.info(
                "source_disposal_job_attempted job_id=%s source_id=%s",
                disposal_job.id,
                disposal_job.source_id,
            )
        job = process_one_job(
            database_url, minio_client, settings.minio_bucket, settings.worker_id
        )
        if job:
            logger.info("ingestion_job_attempted job_id=%s source_id=%s", job.id, job.source_id)
        READY_FILE.touch()
        time.sleep(settings.poll_interval_seconds)


if __name__ == "__main__":
    main()
