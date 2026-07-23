from __future__ import annotations

from dataclasses import dataclass

import psycopg
from minio import Minio
from psycopg.rows import dict_row


@dataclass(frozen=True)
class SourceDisposalJob:
    id: str
    source_id: str
    object_key: str
    attempts: int
    max_attempts: int


def recover_stale_disposal_jobs(database_url: str) -> int:
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        rows = connection.execute(
            """
            UPDATE source_disposal_jobs
            SET status = 'retry', locked_at = NULL, locked_by = NULL,
                available_at = now(), last_error = 'Worker lease expired', updated_at = now()
            WHERE status = 'processing' AND locked_at < now() - interval '5 minutes'
            RETURNING source_id
            """
        ).fetchall()
        if rows:
            connection.execute(
                """
                UPDATE source_material
                SET object_status = 'disposal_pending',
                    disposal_failure_reason = 'Worker lease expired'
                WHERE id = ANY(%s::uuid[])
                """,
                ([row[0] for row in rows],),
            )
        return len(rows)


def claim_disposal_job(database_url: str, worker_id: str) -> SourceDisposalJob | None:
    with psycopg.connect(database_url, connect_timeout=5, row_factory=dict_row) as connection:
        row = connection.execute(
            """
            WITH candidate AS (
              SELECT id FROM source_disposal_jobs
              WHERE status IN ('pending', 'retry')
                AND available_at <= now()
                AND attempts < max_attempts
              ORDER BY available_at, created_at, id
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            ), claimed AS (
              UPDATE source_disposal_jobs j
              SET status = 'processing', attempts = attempts + 1, locked_at = now(),
                  locked_by = %s, last_error = NULL, updated_at = now()
              FROM candidate WHERE j.id = candidate.id
              RETURNING j.id, j.source_id, j.attempts, j.max_attempts
            )
            SELECT c.id, c.source_id, c.attempts, c.max_attempts, s.object_key
            FROM claimed c JOIN source_material s ON s.id = c.source_id
            """,
            (worker_id,),
        ).fetchone()
        if not row:
            return None
        return SourceDisposalJob(
            id=str(row["id"]),
            source_id=str(row["source_id"]),
            object_key=row["object_key"],
            attempts=row["attempts"],
            max_attempts=row["max_attempts"],
        )


def complete_disposal(database_url: str, job: SourceDisposalJob) -> None:
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute(
            """
            UPDATE source_material
            SET object_status = 'disposed', disposed_at = now(), disposal_failure_reason = NULL
            WHERE id = %s
            """,
            (job.source_id,),
        )
        connection.execute(
            """
            UPDATE source_disposal_jobs
            SET status = 'completed', completed_at = now(), locked_at = NULL,
                locked_by = NULL, last_error = NULL, updated_at = now()
            WHERE id = %s
            """,
            (job.id,),
        )


def fail_disposal(database_url: str, job: SourceDisposalJob, error: Exception) -> None:
    terminal = job.attempts >= job.max_attempts
    safe_error = f"{error.__class__.__name__}: source disposal failed"[:500]
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute(
            """
            UPDATE source_disposal_jobs
            SET status = %s, last_error = %s, locked_at = NULL, locked_by = NULL,
                available_at = now() + (%s * interval '1 second'), updated_at = now()
            WHERE id = %s
            """,
            ("failed" if terminal else "retry", safe_error, min(60, 2**job.attempts), job.id),
        )
        connection.execute(
            """
            UPDATE source_material
            SET object_status = %s, disposal_failure_reason = %s
            WHERE id = %s
            """,
            ("disposal_failed" if terminal else "disposal_pending", safe_error, job.source_id),
        )


def process_one_disposal_job(
    database_url: str,
    client: Minio,
    bucket: str,
    worker_id: str,
) -> SourceDisposalJob | None:
    job = claim_disposal_job(database_url, worker_id)
    if not job:
        return None
    try:
        client.remove_object(bucket, job.object_key)
        complete_disposal(database_url, job)
    except Exception as error:
        fail_disposal(database_url, job, error)
    return job
