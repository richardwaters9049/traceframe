import { describe, expect, test } from "bun:test";

import { classifyWorkerHeartbeat } from "@/lib/operations/contracts";

describe("classifyWorkerHeartbeat", () => {
  const checkedAt = new Date("2026-07-23T18:00:00.000Z");

  test("reports recent database heartbeats as available", () => {
    expect(classifyWorkerHeartbeat("2026-07-23T17:59:31.000Z", checkedAt)).toBe(
      "available",
    );
  });

  test("distinguishes delayed and unavailable workers", () => {
    expect(classifyWorkerHeartbeat("2026-07-23T17:59:00.000Z", checkedAt)).toBe(
      "degraded",
    );
    expect(classifyWorkerHeartbeat("2026-07-23T17:57:59.000Z", checkedAt)).toBe(
      "unavailable",
    );
    expect(classifyWorkerHeartbeat(null, checkedAt)).toBe("unavailable");
  });
});
