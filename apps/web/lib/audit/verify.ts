import { createAuditHash } from "@/lib/audit/hash";

export type VerifiableAuditEvent = {
  id: string;
  ledgerSequence: number;
  actorId: string;
  action: string;
  objectType: string;
  objectId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  previousHash: string | null;
  eventHash: string;
  occurredAt: string;
};

export type AuditVerification =
  | { status: "verified"; checkedEvents: number; headHash: string | null }
  | { status: "broken"; checkedEvents: number; eventId: string; reason: "sequence" | "predecessor" | "digest" }
  | { status: "unavailable"; checkedEvents: 0; reason: string };

export function verifyAuditEvents(events: VerifiableAuditEvent[]): AuditVerification {
  let previousHash: string | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.ledgerSequence !== index + 1) {
      return { status: "broken", checkedEvents: index, eventId: event.id, reason: "sequence" };
    }
    if (event.previousHash !== previousHash) {
      return { status: "broken", checkedEvents: index, eventId: event.id, reason: "predecessor" };
    }

    const digest = createAuditHash({
      actorId: event.actorId,
      action: event.action,
      objectType: event.objectType,
      objectId: event.objectId,
      reason: event.reason,
      metadata: event.metadata,
      previousHash: event.previousHash,
      occurredAt: event.occurredAt,
    });
    if (digest !== event.eventHash) {
      return { status: "broken", checkedEvents: index, eventId: event.id, reason: "digest" };
    }
    previousHash = event.eventHash;
  }

  return { status: "verified", checkedEvents: events.length, headHash: previousHash };
}
