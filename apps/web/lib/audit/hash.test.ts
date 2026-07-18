import { describe, expect, test } from "bun:test";

import { createAuditHash } from "@/lib/audit/hash";

const event = {
  actorId: "local-analyst",
  action: "case.created",
  objectType: "case",
  objectId: "018f0f4a-7b76-7000-8000-000000000001",
  reason: "Initial case record created",
  metadata: { status: "open", priority: "standard" },
  previousHash: null,
  occurredAt: "2026-07-18T10:00:00.000Z",
};

describe("createAuditHash", () => {
  test("produces a deterministic SHA-256 digest", () => {
    const first = createAuditHash(event);
    const second = createAuditHash({
      ...event,
      metadata: { priority: "standard", status: "open" },
    });

    expect(first).toHaveLength(64);
    expect(second).toBe(first);
  });

  test("links the digest to the previous event", () => {
    const rootHash = createAuditHash(event);
    const linkedHash = createAuditHash({ ...event, previousHash: "abc123" });

    expect(linkedHash).not.toBe(rootHash);
  });
});
