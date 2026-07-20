import { createHash } from "node:crypto";

export type AuditHashInput = {
  actorId: string;
  action: string;
  objectType: string;
  objectId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  previousHash: string | null;
  occurredAt: string;
};

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }

  return value;
}

export function createAuditHash(input: AuditHashInput) {
  const canonicalEvent = JSON.stringify(sortValue(input));

  return createHash("sha256").update(canonicalEvent).digest("hex");
}
