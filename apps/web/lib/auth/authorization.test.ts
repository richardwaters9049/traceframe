import { describe, expect, test } from "bun:test";

import { can } from "@/lib/auth/authorization";

describe("workspace authorisation", () => {
  test("allows analysts to read and create cases", () => {
    expect(can({ role: "analyst" }, "cases:read")).toBe(true);
    expect(can({ role: "analyst" }, "cases:create")).toBe(true);
  });

  test("keeps reviewers read-only and denies unknown roles", () => {
    expect(can({ role: "reviewer" }, "cases:read")).toBe(true);
    expect(can({ role: "reviewer" }, "cases:create")).toBe(false);
    expect(can({ role: "unknown" }, "cases:read")).toBe(false);
  });
});
