import "server-only";

import { createAuditHash } from "@/lib/audit/hash";
import { verifyAuditEvents, type AuditVerification, type VerifiableAuditEvent } from "@/lib/audit/verify";
import type { AuditEventRecord, CaseCursorPage, CaseRecord, CreateCaseInput } from "@/lib/cases/contracts";
import { getDatabaseClient } from "@/lib/db/client";
import { listCaseSources } from "@/lib/sources/repository";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
export type CasePageDirection = "next" | "previous" | "last";

type CaseRow = {
  id: string; title: string; summary: string; status: string; priority: string;
  created_at: Date; updated_at: Date;
};

type AuditEventRow = {
  id: string; ledger_sequence: string; actor_id: string; action: string;
  object_type: string; object_id: string; reason: string | null;
  metadata: Record<string, unknown>; event_hash: string; previous_hash: string | null;
  created_at: Date;
};

type Cursor = { createdAt: string; id: string };

function serialiseCase(row: CaseRow): CaseRecord {
  return { id: row.id, title: row.title, summary: row.summary, status: row.status,
    priority: row.priority, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}

function serialiseAuditEvent(row: AuditEventRow): AuditEventRecord {
  return { id: row.id, ledgerSequence: Number(row.ledger_sequence), actorId: row.actor_id,
    action: row.action, objectType: row.object_type, objectId: row.object_id, reason: row.reason,
    eventHash: row.event_hash, previousHash: row.previous_hash, createdAt: row.created_at.toISOString() };
}

function toVerifiableEvent(row: AuditEventRow): VerifiableAuditEvent {
  return { ...serialiseAuditEvent(row), metadata: row.metadata, occurredAt: row.created_at.toISOString() };
}

export function encodeCaseCursor(record: Pick<CaseRecord, "createdAt" | "id">) {
  return Buffer.from(JSON.stringify({ createdAt: record.createdAt, id: record.id } satisfies Cursor)).toString("base64url");
}

export function decodeCaseCursor(value: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string" || Number.isNaN(Date.parse(parsed.createdAt))) return null;
    if (typeof parsed.id !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.id)) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch { return null; }
}

export async function createCase(input: CreateCaseInput, actorId: string): Promise<CaseRecord> {
  const sql = getDatabaseClient();
  return sql.begin(async (transaction) => {
    const [createdCase] = await transaction<CaseRow[]>`
      INSERT INTO cases (title, summary, priority) VALUES (${input.title}, ${input.summary}, ${input.priority})
      RETURNING id, title, summary, status, priority, created_at, updated_at`;

    const [head] = await transaction<{ last_sequence: string; last_event_hash: string | null }[]>`
      SELECT last_sequence, last_event_hash FROM audit_chain_heads WHERE ledger = 'global' FOR UPDATE`;
    if (!head) throw new Error("Global audit chain head is missing");

    const occurredAt = new Date().toISOString();
    const metadata = { priority: createdCase.priority, status: createdCase.status };
    const previousHash = head.last_event_hash;
    const ledgerSequence = Number(head.last_sequence) + 1;
    const eventHash = createAuditHash({ actorId, action: "case.created", objectType: "case",
      objectId: createdCase.id, reason: "Initial case record created", metadata, previousHash, occurredAt });

    await transaction`
      INSERT INTO audit_events (ledger_sequence, actor_id, action, object_type, object_id, reason, metadata, previous_hash, event_hash, created_at)
      VALUES (${ledgerSequence}, ${actorId}, 'case.created', 'case', ${createdCase.id},
        'Initial case record created', ${transaction.json(metadata)}, ${previousHash}, ${eventHash}, ${occurredAt})`;
    await transaction`
      UPDATE audit_chain_heads SET last_sequence = ${ledgerSequence}, last_event_hash = ${eventHash}, updated_at = now()
      WHERE ledger = 'global'`;
    return serialiseCase(createdCase);
  });
}

export async function listCasePage(
  cursorValue?: string | null,
  requestedLimit = DEFAULT_PAGE_SIZE,
  direction: CasePageDirection = "next",
): Promise<CaseCursorPage> {
  const sql = getDatabaseClient();
  const limit = Math.min(Math.max(1, requestedLimit), MAX_PAGE_SIZE);
  const cursor = cursorValue ? decodeCaseCursor(cursorValue) : null;
  if (cursorValue && !cursor) throw new Error("INVALID_CURSOR");
  if (direction === "previous" && !cursor) throw new Error("INVALID_CURSOR");
  if (direction === "last" && cursor) throw new Error("INVALID_CURSOR");

  const [{ count, urgent_count: urgentCount }] = await sql<{ count: string; urgent_count: string }[]>`
    SELECT count(*)::text AS count,
      count(*) FILTER (WHERE priority IN ('high', 'critical'))::text AS urgent_count
    FROM cases`;
  const totalCount = Number(count);

  let cases: CaseRecord[];
  let previousCursor: string | null = null;
  let nextCursor: string | null = null;

  if (direction === "last") {
    const lastPageSize = totalCount === 0 ? 0 : totalCount % limit || Math.min(limit, totalCount);
    const rows = lastPageSize
      ? await sql<CaseRow[]>`SELECT id, title, summary, status, priority, created_at, updated_at FROM cases
          ORDER BY created_at ASC, id ASC LIMIT ${lastPageSize}`
      : [];
    cases = rows.reverse().map(serialiseCase);
    previousCursor = totalCount > cases.length && cases.length ? encodeCaseCursor(cases[0]) : null;
  } else if (direction === "previous" && cursor) {
    const rows = await sql<CaseRow[]>`SELECT id, title, summary, status, priority, created_at, updated_at FROM cases
      WHERE (created_at, id) > (${cursor.createdAt}, ${cursor.id})
      ORDER BY created_at ASC, id ASC LIMIT ${limit + 1}`;
    const hasMoreNewer = rows.length > limit;
    cases = rows.slice(0, limit).reverse().map(serialiseCase);
    previousCursor = hasMoreNewer && cases.length ? encodeCaseCursor(cases[0]) : null;
    nextCursor = cases.length ? encodeCaseCursor(cases[cases.length - 1]) : null;
  } else {
    const rows = cursor
      ? await sql<CaseRow[]>`SELECT id, title, summary, status, priority, created_at, updated_at FROM cases
          WHERE (created_at, id) < (${cursor.createdAt}, ${cursor.id}) ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`
      : await sql<CaseRow[]>`SELECT id, title, summary, status, priority, created_at, updated_at FROM cases
          ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`;
    const hasMoreOlder = rows.length > limit;
    cases = rows.slice(0, limit).map(serialiseCase);
    previousCursor = cursor && cases.length ? encodeCaseCursor(cases[0]) : null;
    nextCursor = hasMoreOlder && cases.length ? encodeCaseCursor(cases[cases.length - 1]) : null;
  }

  return { cases, previousCursor, nextCursor, totalCount, urgentCount: Number(urgentCount) };
}

export async function verifyGlobalAuditLedger(): Promise<AuditVerification> {
  try {
    const sql = getDatabaseClient();
    const rows = await sql<AuditEventRow[]>`
      SELECT id, ledger_sequence, actor_id, action, object_type, object_id, reason, metadata,
        event_hash, previous_hash, created_at FROM audit_events ORDER BY ledger_sequence ASC`;
    return verifyAuditEvents(rows.map(toVerifiableEvent));
  } catch {
    return { status: "unavailable", checkedEvents: 0, reason: "Ledger verification could not be completed." };
  }
}

export async function getCaseWorkspace(caseId: string) {
  const sql = getDatabaseClient();
  const [caseRows, auditRows, verification, sources] = await Promise.all([
    sql<CaseRow[]>`SELECT id, title, summary, status, priority, created_at, updated_at FROM cases WHERE id = ${caseId} LIMIT 1`,
    sql<AuditEventRow[]>`SELECT id, ledger_sequence, actor_id, action, object_type, object_id, reason, metadata,
      event_hash, previous_hash, created_at FROM audit_events
      WHERE object_type = 'case' AND object_id = ${caseId} ORDER BY ledger_sequence DESC`,
    verifyGlobalAuditLedger(),
    listCaseSources(caseId),
  ]);
  if (!caseRows[0]) return null;
  return { case: serialiseCase(caseRows[0]), auditEvents: auditRows.map(serialiseAuditEvent), verification, sources };
}
