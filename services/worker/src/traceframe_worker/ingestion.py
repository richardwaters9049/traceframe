from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass

import psycopg
from minio import Minio
from psycopg.rows import dict_row

MAX_SOURCE_BYTES = 1024 * 1024
MAX_USER_AGENT_LENGTH = 512
MAX_USER_AGENT_OBSERVATIONS = 50
URL_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)
EMAIL_PATTERN = re.compile(
    r"(?<![\w.+-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![\w.-])", re.IGNORECASE
)
IPV4_PATTERN = re.compile(r"(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)")
DOMAIN_PATTERN = re.compile(
    r"(?<![A-Z0-9-])(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}(?![A-Z0-9-])",
    re.IGNORECASE,
)
SHA256_PATTERN = re.compile(r"(?<![A-F0-9])[A-F0-9]{64}(?![A-F0-9])", re.IGNORECASE)


@dataclass(frozen=True)
class IngestionJob:
    id: str
    source_id: str
    object_key: str
    media_type: str
    size_bytes: int
    sha256: str
    attempts: int
    max_attempts: int


def create_minio_client(endpoint: str, access_key: str, secret_key: str, region: str) -> Minio:
    endpoint_value = endpoint.removeprefix("http://").removeprefix("https://").rstrip("/")
    return Minio(
        endpoint_value,
        access_key=access_key,
        secret_key=secret_key,
        secure=endpoint.startswith("https://"),
        region=region,
    )


def recover_stale_jobs(database_url: str) -> int:
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        result = connection.execute(
            """
            UPDATE ingestion_jobs
            SET status = 'retry', locked_at = NULL, locked_by = NULL,
                available_at = now(), last_error = 'Worker lease expired', updated_at = now()
            WHERE status = 'processing' AND locked_at < now() - interval '5 minutes'
            RETURNING id
            """
        )
        return result.rowcount or 0


def claim_ingestion_job(database_url: str, worker_id: str) -> IngestionJob | None:
    with psycopg.connect(database_url, connect_timeout=5, row_factory=dict_row) as connection:
        row = connection.execute(
            """
            WITH candidate AS (
              SELECT id FROM ingestion_jobs
              WHERE status IN ('pending', 'retry')
                AND available_at <= now()
                AND attempts < max_attempts
                AND source_id IS NOT NULL
              ORDER BY available_at, created_at, id
              FOR UPDATE SKIP LOCKED
              LIMIT 1
            ), claimed AS (
              UPDATE ingestion_jobs j
              SET status = 'processing', attempts = attempts + 1, locked_at = now(),
                  locked_by = %s, last_error = NULL, updated_at = now()
              FROM candidate WHERE j.id = candidate.id
              RETURNING j.id, j.source_id, j.source_key, j.attempts, j.max_attempts
            )
            SELECT c.id, c.source_id, c.source_key AS object_key, c.attempts, c.max_attempts,
                   s.media_type, s.size_bytes, s.sha256
            FROM claimed c JOIN source_material s ON s.id = c.source_id
            """,
            (worker_id,),
        ).fetchone()
        if not row:
            return None
        connection.execute(
            "UPDATE source_material SET status = 'processing', failure_reason = NULL WHERE id = %s",
            (row["source_id"],),
        )
        return IngestionJob(
            id=str(row["id"]),
            source_id=str(row["source_id"]),
            object_key=row["object_key"],
            media_type=row["media_type"],
            size_bytes=int(row["size_bytes"]),
            sha256=row["sha256"],
            attempts=row["attempts"],
            max_attempts=row["max_attempts"],
        )


def normalise_source(payload: bytes, media_type: str) -> str:
    if not payload or len(payload) > MAX_SOURCE_BYTES:
        raise ValueError("invalid source size")
    text = payload.decode("utf-8")
    if "\x00" in text:
        raise ValueError("source contains null bytes")
    if media_type == "application/json":
        text = json.dumps(json.loads(text), indent=2, sort_keys=True, ensure_ascii=False)
    return "\n".join(
        line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ).strip()


def derive_user_agent_observations(text: str) -> list[tuple[str, str]]:
    counts: dict[str, int] = {}
    for line in text.splitlines():
        name, separator, raw_value = line.partition(":")
        if not separator or name.strip().casefold() != "user-agent":
            continue
        value = re.sub(r"[ \t]+", " ", raw_value.strip(" \t"))
        if (
            not value
            or len(value) > MAX_USER_AGENT_LENGTH
            or any(ord(character) < 0x20 or ord(character) == 0x7F for character in value)
        ):
            continue
        if value in counts:
            counts[value] += 1
        elif len(counts) < MAX_USER_AGENT_OBSERVATIONS:
            counts[value] = 1
    return [(value, occurrences) for value, occurrences in counts.items()]


def derive_observations(text: str) -> list[tuple[str, str, int]]:
    values: list[tuple[str, str]] = []
    values.extend(
        ("url", re.sub(r"[.,;:!?)\]}]+$", "", match)) for match in URL_PATTERN.findall(text)
    )
    values.extend(("email", match.lower()) for match in EMAIL_PATTERN.findall(text))
    values.extend(("domain", match.lower()) for match in DOMAIN_PATTERN.findall(text))
    values.extend(("sha256", match.lower()) for match in SHA256_PATTERN.findall(text))
    values.extend(
        ("ipv4", match)
        for match in IPV4_PATTERN.findall(text)
        if all(0 <= int(part) <= 255 for part in match.split("."))
    )
    counts = Counter(values)
    counts.update({
        ("user_agent", value): occurrences
        for value, occurrences in derive_user_agent_observations(text)
    })
    return [(kind, value, occurrences) for (kind, value), occurrences in sorted(counts.items())]


def read_source(client: Minio, bucket: str, job: IngestionJob) -> bytes:
    response = client.get_object(bucket, job.object_key)
    try:
        payload = response.read(MAX_SOURCE_BYTES + 1)
    finally:
        response.close()
        response.release_conn()
    if len(payload) != job.size_bytes or hashlib.sha256(payload).hexdigest() != job.sha256:
        raise ValueError("source integrity check failed")
    return payload


def complete_job(
    database_url: str, job: IngestionJob, text: str, observations: list[tuple[str, str, int]]
) -> None:
    line_count = len(text.splitlines()) if text else 0
    word_count = len(text.split())
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute(
            """
            INSERT INTO normalised_sources
              (source_id, normalised_text, character_count, line_count, word_count)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (source_id) DO UPDATE SET normalised_text = excluded.normalised_text,
              character_count = excluded.character_count, line_count = excluded.line_count,
              word_count = excluded.word_count, created_at = now()
            """,
            (job.source_id, text, len(text), line_count, word_count),
        )
        connection.execute("DELETE FROM source_observations WHERE source_id = %s", (job.source_id,))
        if observations:
            connection.cursor().executemany(
                """
                INSERT INTO source_observations (source_id, kind, value, occurrences)
                VALUES (%s, %s, %s, %s)
                """,
                [(job.source_id, kind, value, count) for kind, value, count in observations],
            )
        connection.execute(
            """
            UPDATE source_material
            SET status = 'ready', failure_reason = NULL, processed_at = now()
            WHERE id = %s
            """,
            (job.source_id,),
        )
        connection.execute(
            """
            UPDATE ingestion_jobs
            SET status = 'completed', completed_at = now(), locked_at = NULL,
                locked_by = NULL, last_error = NULL, updated_at = now()
            WHERE id = %s
            """,
            (job.id,),
        )


def fail_job(database_url: str, job: IngestionJob, error: Exception) -> None:
    terminal = job.attempts >= job.max_attempts
    safe_error = f"{error.__class__.__name__}: source processing failed"[:500]
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute(
            """
            UPDATE ingestion_jobs
            SET status = %s, last_error = %s, locked_at = NULL, locked_by = NULL,
                available_at = now() + (%s * interval '1 second'), updated_at = now()
            WHERE id = %s
            """,
            ("failed" if terminal else "retry", safe_error, min(60, 2**job.attempts), job.id),
        )
        connection.execute(
            "UPDATE source_material SET status = %s, failure_reason = %s WHERE id = %s",
            ("failed" if terminal else "queued", safe_error, job.source_id),
        )


def process_one_job(
    database_url: str, client: Minio, bucket: str, worker_id: str
) -> IngestionJob | None:
    job = claim_ingestion_job(database_url, worker_id)
    if not job:
        return None
    try:
        text = normalise_source(read_source(client, bucket, job), job.media_type)
        complete_job(database_url, job, text, derive_observations(text))
    except Exception as error:
        fail_job(database_url, job, error)
    return job
