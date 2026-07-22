import "server-only";

import type postgres from "postgres";

import { createAuditHash } from "@/lib/audit/hash";
import { getDatabaseClient } from "@/lib/db/client";
import type { FindingRecord, ProposeFindingInput, ReviewFindingInput } from "@/lib/findings/contracts";
import { summariseFindings } from "@/lib/findings/summary";

type FindingRow = {
  id: string; case_id: string; observation_id: string; source_id: string; original_filename: string;
  kind: FindingRecord["kind"]; value: string; occurrences: number; status: FindingRecord["status"];
  analyst_note: string; review_rationale: string | null; created_by: string; reviewed_by: string | null;
  created_at: Date; updated_at: Date; reviewed_at: Date | null;
};

type FindingExportCaseRow = {
  id: string; title: string; status: string; priority: string; created_at: Date;
};

function serialiseFinding(row: FindingRow): FindingRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    observationId: row.observation_id,
    sourceId: row.source_id,
    sourceFilename: row.original_filename,
    kind: row.kind,
    value: row.value,
    occurrences: row.occurrences,
    status: row.status,
    analystNote: row.analyst_note,
    reviewRationale: row.review_rationale,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

async function appendFindingAuditEvent(
  transaction: postgres.TransactionSql,
  input: { actorEmail: string; action: string; caseId: string; findingId: string; observationId: string; status: FindingRecord["status"] },
) {
  const [head] = await transaction<{ last_sequence: string; last_event_hash: string | null }[]>`
    SELECT last_sequence, last_event_hash FROM audit_chain_heads WHERE ledger = 'global' FOR UPDATE`;
  if (!head) throw new Error("Global audit chain head is missing");

  const occurredAt = new Date().toISOString();
  const metadata = { findingId: input.findingId, observationId: input.observationId, status: input.status };
  const reason = input.status === "proposed" ? "Observation promoted for analyst review"
    : input.status === "confirmed" ? "Analyst finding confirmed" : "Analyst finding dismissed";
  const ledgerSequence = Number(head.last_sequence) + 1;
  const eventHash = createAuditHash({
    actorId: input.actorEmail,
    action: input.action,
    objectType: "case",
    objectId: input.caseId,
    reason,
    metadata,
    previousHash: head.last_event_hash,
    occurredAt,
  });

  await transaction`
    INSERT INTO audit_events
      (ledger_sequence, actor_id, action, object_type, object_id, reason, metadata, previous_hash, event_hash, created_at)
    VALUES (${ledgerSequence}, ${input.actorEmail}, ${input.action}, 'case', ${input.caseId}, ${reason},
      ${transaction.json(metadata)}, ${head.last_event_hash}, ${eventHash}, ${occurredAt})`;
  await transaction`
    UPDATE audit_chain_heads SET last_sequence = ${ledgerSequence}, last_event_hash = ${eventHash}, updated_at = now()
    WHERE ledger = 'global'`;
}

export async function getCaseFindings(caseId: string) {
  const sql = getDatabaseClient();
  const rows = await sql<FindingRow[]>`
    SELECT f.id, f.case_id, f.observation_id, o.source_id, s.original_filename, o.kind, o.value,
      o.occurrences, f.status, f.analyst_note, f.review_rationale, creator.email AS created_by,
      reviewer.email AS reviewed_by, f.created_at, f.updated_at, f.reviewed_at
    FROM findings f
    JOIN source_observations o ON o.id = f.observation_id
    JOIN source_material s ON s.id = o.source_id
    JOIN users creator ON creator.id = f.created_by
    LEFT JOIN users reviewer ON reviewer.id = f.reviewed_by
    WHERE f.case_id = ${caseId}
    ORDER BY f.created_at DESC, f.id DESC`;
  const findings = rows.map(serialiseFinding);
  return { findings, summary: summariseFindings(findings) };
}

export async function getFindingExportData(caseId: string) {
  const sql = getDatabaseClient();
  const [caseRows, collection] = await Promise.all([
    sql<FindingExportCaseRow[]>`
      SELECT id, title, status, priority, created_at FROM cases WHERE id = ${caseId} LIMIT 1`,
    getCaseFindings(caseId),
  ]);
  const record = caseRows[0];
  if (!record) return null;
  return {
    case: {
      id: record.id,
      title: record.title,
      status: record.status,
      priority: record.priority,
      createdAt: record.created_at.toISOString(),
    },
    findings: collection.findings,
  };
}

export async function proposeFinding(
  caseId: string,
  input: ProposeFindingInput,
  actor: { id: string; email: string },
) {
  const sql = getDatabaseClient();
  try {
    return await sql.begin(async (transaction) => {
      const [finding] = await transaction<{ id: string; observation_id: string }[]>`
        INSERT INTO findings (case_id, observation_id, analyst_note, created_by)
        SELECT ${caseId}, o.id, ${input.note}, ${actor.id}
        FROM source_observations o
        JOIN source_material s ON s.id = o.source_id
        WHERE o.id = ${input.observationId} AND s.case_id = ${caseId}
        RETURNING id, observation_id`;
      if (!finding) throw new Error("OBSERVATION_NOT_FOUND");
      await appendFindingAuditEvent(transaction, {
        actorEmail: actor.email,
        action: "finding.proposed",
        caseId,
        findingId: finding.id,
        observationId: finding.observation_id,
        status: "proposed",
      });
      return finding.id;
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new Error("FINDING_EXISTS");
    }
    throw error;
  }
}

export async function reviewFinding(
  caseId: string,
  findingId: string,
  input: ReviewFindingInput,
  actor: { id: string; email: string },
) {
  const sql = getDatabaseClient();
  await sql.begin(async (transaction) => {
    const [finding] = await transaction<{ id: string; observation_id: string; status: FindingRecord["status"] }[]>`
      SELECT id, observation_id, status FROM findings
      WHERE id = ${findingId} AND case_id = ${caseId}
      FOR UPDATE`;
    if (!finding) throw new Error("FINDING_NOT_FOUND");
    if (finding.status !== "proposed") throw new Error("FINDING_ALREADY_REVIEWED");

    await transaction`
      UPDATE findings SET status = ${input.status}, review_rationale = ${input.rationale},
        reviewed_by = ${actor.id}, reviewed_at = now(), updated_at = now()
      WHERE id = ${finding.id}`;
    await appendFindingAuditEvent(transaction, {
      actorEmail: actor.email,
      action: `finding.${input.status}`,
      caseId,
      findingId: finding.id,
      observationId: finding.observation_id,
      status: input.status,
    });
  });
}
