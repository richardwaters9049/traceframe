import { describe, expect, test } from "bun:test";

import { createCaseSchema, updateCaseStatusSchema } from "@/lib/cases/contracts";

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

describe("updateCaseStatusSchema", () => {
  test("accepts supported lifecycle states", () => {
    expect(updateCaseStatusSchema.parse({ status: "closed" })).toEqual({ status: "closed" });
    expect(updateCaseStatusSchema.parse({ status: "open" })).toEqual({ status: "open" });
  });

  test("rejects unsupported lifecycle states", () => {
    expect(updateCaseStatusSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});
