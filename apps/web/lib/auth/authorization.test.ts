import { describe, expect, test } from "bun:test";

import { can } from "@/lib/auth/authorization";

describe("workspace authorisation", () => {
  test("allows analysts to read and create cases and sources", () => {
    expect(can({ role: "analyst" }, "cases:read")).toBe(true);
    expect(can({ role: "analyst" }, "cases:create")).toBe(true);
    expect(can({ role: "analyst" }, "sources:create")).toBe(true);
  });

  test("keeps reviewers read-only and denies unknown roles", () => {
    expect(can({ role: "reviewer" }, "cases:read")).toBe(true);
    expect(can({ role: "reviewer" }, "cases:create")).toBe(false);
    expect(can({ role: "reviewer" }, "sources:create")).toBe(false);
    expect(can({ role: "unknown" }, "cases:read")).toBe(false);
    expect(can({ role: "unknown" }, "sources:create")).toBe(false);
  });
});
