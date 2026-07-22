import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { createAuditHash } from "@/lib/audit/hash";
import { getDatabaseClient } from "@/lib/db/client";
import type { SourceRecord, SourceUploadInput } from "@/lib/sources/contracts";
import { deleteSourceObject, putSourceObject } from "@/lib/storage/minio";

type SourceRow = {
  id: string; original_filename: string; media_type: string; size_bytes: string; sha256: string;
  status: SourceRecord["status"]; failure_reason: string | null; created_at: Date; processed_at: Date | null;
  character_count: number | null; line_count: number | null; word_count: number | null;
};
type ObservationRow = { id: string; source_id: string; kind: "ipv4" | "url" | "email"; value: string; occurrences: number };

export function serialiseSources(rows: SourceRow[], observations: ObservationRow[]): SourceRecord[] {
  const bySource = new Map<string, ObservationRow[]>();
  for (const observation of observations) bySource.set(observation.source_id, [...(bySource.get(observation.source_id) ?? []), observation]);
  return rows.map((row) => ({
    id: row.id,
    originalFilename: row.original_filename,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    status: row.status,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at?.toISOString() ?? null,
    characterCount: row.character_count,
    lineCount: row.line_count,
    wordCount: row.word_count,
    observations: (bySource.get(row.id) ?? []).map(({ id, kind, value, occurrences }) => ({ id, kind, value, occurrences })),
  }));
}

export async function listCaseSources(caseId: string) {
  const sql = getDatabaseClient();
  const rows = await sql<SourceRow[]>`
    SELECT s.id, s.original_filename, s.media_type, s.size_bytes, s.sha256, s.status,
      s.failure_reason, s.created_at, s.processed_at, n.character_count, n.line_count, n.word_count
    FROM source_material s LEFT JOIN normalised_sources n ON n.source_id = s.id
    WHERE s.case_id = ${caseId} ORDER BY s.created_at DESC, s.id DESC`;
  if (!rows.length) return [];
  const observations = await sql<ObservationRow[]>`
    SELECT o.id, o.source_id, o.kind, o.value, o.occurrences
    FROM source_observations o JOIN source_material s ON s.id = o.source_id
    WHERE s.case_id = ${caseId} ORDER BY o.kind, o.value`;
  return serialiseSources(rows, observations);
}

export async function createSourceUpload(caseId: string, input: SourceUploadInput, actor: { id: string; email: string }) {
  const sql = getDatabaseClient();
  const sourceId = randomUUID();
  const objectKey = `cases/${caseId}/sources/${sourceId}`;
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");

  const [existing] = await sql<{ id: string }[]>`SELECT id FROM source_material WHERE case_id = ${caseId} AND sha256 = ${sha256} LIMIT 1`;
  if (existing) throw new Error("DUPLICATE_SOURCE");
  const [record] = await sql<{ id: string }[]>`SELECT id FROM cases WHERE id = ${caseId} LIMIT 1`;
  if (!record) throw new Error("CASE_NOT_FOUND");

  await putSourceObject(objectKey, input.bytes, input.mediaType);
  try {
    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO source_material
          (id, case_id, object_key, original_filename, media_type, size_bytes, sha256, uploaded_by)
        VALUES (${sourceId}, ${caseId}, ${objectKey}, ${input.filename}, ${input.mediaType},
          ${input.bytes.byteLength}, ${sha256}, ${actor.id})`;
      await transaction`
        INSERT INTO ingestion_jobs (case_id, source_id, source_key)
        VALUES (${caseId}, ${sourceId}, ${objectKey})`;

      const [head] = await transaction<{ last_sequence: string; last_event_hash: string | null }[]>`
        SELECT last_sequence, last_event_hash FROM audit_chain_heads WHERE ledger = 'global' FOR UPDATE`;
      if (!head) throw new Error("Global audit chain head is missing");
      const occurredAt = new Date().toISOString();
      const metadata = { sourceId, mediaType: input.mediaType, sizeBytes: input.bytes.byteLength, sha256 };
      const ledgerSequence = Number(head.last_sequence) + 1;
      const eventHash = createAuditHash({ actorId: actor.email, action: "source.uploaded", objectType: "case",
        objectId: caseId, reason: "Synthetic source material uploaded", metadata,
        previousHash: head.last_event_hash, occurredAt });
      await transaction`
        INSERT INTO audit_events
          (ledger_sequence, actor_id, action, object_type, object_id, reason, metadata, previous_hash, event_hash, created_at)
        VALUES (${ledgerSequence}, ${actor.email}, 'source.uploaded', 'case', ${caseId},
          'Synthetic source material uploaded', ${transaction.json(metadata)}, ${head.last_event_hash}, ${eventHash}, ${occurredAt})`;
      await transaction`
        UPDATE audit_chain_heads SET last_sequence = ${ledgerSequence}, last_event_hash = ${eventHash}, updated_at = now()
        WHERE ledger = 'global'`;
    });
  } catch (error) {
    await deleteSourceObject(objectKey).catch(() => undefined);
    if (error && typeof error === "object" && "code" in error && error.code === "23505") throw new Error("DUPLICATE_SOURCE");
    throw error;
  }
  return sourceId;
}
