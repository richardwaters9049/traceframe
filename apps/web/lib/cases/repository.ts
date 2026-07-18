import { getDatabaseClient } from "@/lib/db/client";
import { createAuditHash } from "@/lib/audit/hash";
import type {
  AuditEventRecord,
  CaseRecord,
  CreateCaseInput,
} from "@/lib/cases/contracts";

type CaseRow = {
  id: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  created_at: Date;
  updated_at: Date;
};

type AuditEventRow = {
  id: string;
  actor_id: string;
  action: string;
  object_type: string;
  object_id: string;
  reason: string | null;
  event_hash: string;
  previous_hash: string | null;
  created_at: Date;
};

function serialiseCase(row: CaseRow): CaseRecord {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function serialiseAuditEvent(row: AuditEventRow): AuditEventRecord {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    objectType: row.object_type,
    objectId: row.object_id,
    reason: row.reason,
    eventHash: row.event_hash,
    previousHash: row.previous_hash,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createCase(
  input: CreateCaseInput,
  actorId: string,
): Promise<CaseRecord> {
  const sql = getDatabaseClient();

  return sql.begin(async (transaction) => {
    const [createdCase] = await transaction<CaseRow[]>`
      INSERT INTO cases (title, summary, priority)
      VALUES (${input.title}, ${input.summary}, ${input.priority})
      RETURNING id, title, summary, status, priority, created_at, updated_at
    `;

    // Serialise writers so every event extends one unambiguous hash chain.
    await transaction`SELECT pg_advisory_xact_lock(3685)`;

    const [previousEvent] = await transaction<{ event_hash: string }[]>`
      SELECT event_hash
      FROM audit_events
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;

    const occurredAt = new Date().toISOString();
    const metadata = { priority: createdCase.priority, status: createdCase.status };
    const previousHash = previousEvent?.event_hash ?? null;
    const eventHash = createAuditHash({
      actorId,
      action: "case.created",
      objectType: "case",
      objectId: createdCase.id,
      reason: "Initial case record created",
      metadata,
      previousHash,
      occurredAt,
    });

    await transaction`
      INSERT INTO audit_events (
        actor_id,
        action,
        object_type,
        object_id,
        reason,
        metadata,
        previous_hash,
        event_hash,
        created_at
      )
      VALUES (
        ${actorId},
        'case.created',
        'case',
        ${createdCase.id},
        'Initial case record created',
        ${transaction.json(metadata)},
        ${previousHash},
        ${eventHash},
        ${occurredAt}
      )
    `;

    return serialiseCase(createdCase);
  });
}

export async function listCases(): Promise<CaseRecord[]> {
  const sql = getDatabaseClient();
  const rows = await sql<CaseRow[]>`
    SELECT id, title, summary, status, priority, created_at, updated_at
    FROM cases
    ORDER BY created_at DESC
  `;

  return rows.map(serialiseCase);
}

export async function getCaseWorkspace(caseId: string) {
  const sql = getDatabaseClient();
  const [caseRows, auditRows] = await Promise.all([
    sql<CaseRow[]>`
      SELECT id, title, summary, status, priority, created_at, updated_at
      FROM cases
      WHERE id = ${caseId}
      LIMIT 1
    `,
    sql<AuditEventRow[]>`
      SELECT
        id,
        actor_id,
        action,
        object_type,
        object_id,
        reason,
        event_hash,
        previous_hash,
        created_at
      FROM audit_events
      WHERE object_type = 'case' AND object_id = ${caseId}
      ORDER BY created_at DESC, id DESC
    `,
  ]);

  const caseRow = caseRows[0];

  if (!caseRow) {
    return null;
  }

  return {
    case: serialiseCase(caseRow),
    auditEvents: auditRows.map(serialiseAuditEvent),
  };
}
