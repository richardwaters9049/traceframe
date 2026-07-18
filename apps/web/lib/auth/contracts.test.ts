import { describe, expect, test } from "bun:test";

import { loginSchema } from "@/lib/auth/contracts";

describe("loginSchema", () => {
  test("normalises an email address", () => {
    expect(
      loginSchema.parse({
        email: "  ANALYST@TRACEFRAME.LOCAL ",
        password: "Traceframe!2026",
      }).email,
    ).toBe("analyst@traceframe.local");
  });

  test("rejects short credentials", () => {
    expect(
      loginSchema.safeParse({ email: "not-an-email", password: "short" }).success,
    ).toBe(false);
  });
});
