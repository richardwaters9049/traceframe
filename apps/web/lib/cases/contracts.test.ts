import { describe, expect, test } from "bun:test";

import { createCaseSchema } from "@/lib/cases/contracts";

describe("createCaseSchema", () => {
  test("normalises valid case details", () => {
    expect(
      createCaseSchema.parse({
        title: "  Unusual authentication activity  ",
        summary: "  Multiple synthetic login attempts.  ",
        priority: "high",
      }),
    ).toEqual({
      title: "Unusual authentication activity",
      summary: "Multiple synthetic login attempts.",
      priority: "high",
    });
  });

  test("rejects unsupported priorities", () => {
    const result = createCaseSchema.safeParse({
      title: "Synthetic incident",
      summary: "",
      priority: "urgent",
    });

    expect(result.success).toBe(false);
  });
});
