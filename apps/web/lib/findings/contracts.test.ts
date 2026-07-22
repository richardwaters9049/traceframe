import { describe, expect, test } from "bun:test";

import { proposeFindingSchema, reviewFindingSchema } from "@/lib/findings/contracts";

describe("finding contracts", () => {
  test("normalises a valid proposal and review", () => {
    const proposal = proposeFindingSchema.parse({
      observationId: "11111111-1111-4111-8111-111111111111",
      note: "  Correlates with the synthetic case timeline.  ",
    });
    expect(proposal.note).toBe("Correlates with the synthetic case timeline.");
    expect(reviewFindingSchema.parse({ status: "confirmed", rationale: "  Verified against the source. " }).rationale)
      .toBe("Verified against the source.");
  });

  test("rejects unsupported decisions and empty reasoning", () => {
    expect(proposeFindingSchema.safeParse({ observationId: "invalid", note: "" }).success).toBe(false);
    expect(reviewFindingSchema.safeParse({ status: "proposed", rationale: "No" }).success).toBe(false);
  });
});
