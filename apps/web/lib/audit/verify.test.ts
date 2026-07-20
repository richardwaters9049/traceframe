import { describe, expect, test } from "bun:test";

import { createAuditHash } from "@/lib/audit/hash";
import { verifyAuditEvents, type VerifiableAuditEvent } from "@/lib/audit/verify";

function buildChain(count = 3, times?: string[]) {
  const events: VerifiableAuditEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    const occurredAt = times?.[index] ?? new Date(Date.UTC(2026, 6, 20, 10, index)).toISOString();
    const previousHash = events.at(-1)?.eventHash ?? null;
    const input = {
      actorId: "analyst@traceframe.local",
      action: "case.created",
      objectType: "case",
      objectId: `synthetic-case-${index + 1}`,
      reason: "Initial case record created",
      metadata: { priority: "standard", status: "open" },
      previousHash,
      occurredAt,
    };
    events.push({ id: `event-${index + 1}`, ledgerSequence: index + 1, ...input, eventHash: createAuditHash(input) });
  }
  return events;
}

describe("verifyAuditEvents", () => {
  test("accepts a valid canonical chain", () => {
    expect(verifyAuditEvents(buildChain())).toMatchObject({ status: "verified", checkedEvents: 3 });
  });

  test("detects modified metadata", () => {
    const events = buildChain();
    events[1].metadata = { priority: "critical", status: "open" };
    expect(verifyAuditEvents(events)).toMatchObject({ status: "broken", eventId: "event-2", reason: "digest" });
  });

  test("detects a missing predecessor", () => {
    const events = buildChain();
    events[1].previousHash = null;
    expect(verifyAuditEvents(events)).toMatchObject({ status: "broken", eventId: "event-2", reason: "predecessor" });
  });

  test("detects reordered events", () => {
    const events = buildChain();
    [events[0], events[1]] = [events[1], events[0]];
    expect(verifyAuditEvents(events)).toMatchObject({ status: "broken", reason: "sequence" });
  });

  test("uses ledger sequence rather than wall-clock order", () => {
    const events = buildChain(2, ["2026-07-20T12:00:00.000Z", "2026-07-20T09:00:00.000Z"]);
    expect(verifyAuditEvents(events)).toMatchObject({ status: "verified", checkedEvents: 2 });
  });
});
