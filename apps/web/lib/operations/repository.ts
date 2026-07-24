import "server-only";

import { getDatabaseClient } from "@/lib/db/client";

export type OperationsSnapshot = {
  workerLastSeenAt: string | null;
  queued: number;
  processing: number;
  failed: number;
  disposalPending: number;
};

export async function getOperationsSnapshot(): Promise<OperationsSnapshot> {
  const sql = getDatabaseClient();
  const [snapshot] = await sql<OperationsSnapshot[]>`
    SELECT
      (
        SELECT max(last_seen_at)::text
        FROM service_heartbeats
        WHERE service_name = 'worker'
      ) AS "workerLastSeenAt",
      (
        SELECT count(*)::integer
        FROM ingestion_jobs
        WHERE status IN ('pending', 'retry')
      ) AS "queued",
      (
        SELECT count(*)::integer
        FROM ingestion_jobs
        WHERE status = 'processing'
      ) AS "processing",
      (
        SELECT count(*)::integer
        FROM ingestion_jobs
        WHERE status = 'failed'
      ) AS "failed",
      (
        SELECT count(*)::integer
        FROM source_disposal_jobs
        WHERE status IN ('pending', 'retry', 'processing')
      ) AS "disposalPending"
  `;
  if (!snapshot) throw new Error("OPERATIONS_SNAPSHOT_UNAVAILABLE");
  return snapshot;
}
