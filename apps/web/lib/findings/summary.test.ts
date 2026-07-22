import { describe, expect, test } from "bun:test";

import { summariseFindings } from "@/lib/findings/summary";

describe("summariseFindings", () => {
  test("counts lifecycle states and indicator kinds", () => {
    expect(summariseFindings([
      { status: "proposed", kind: "email" },
      { status: "confirmed", kind: "email" },
      { status: "dismissed", kind: "ipv4" },
      { status: "confirmed", kind: "url" },
      { status: "proposed", kind: "domain" },
      { status: "confirmed", kind: "sha256" },
    ])).toEqual({
      total: 6,
      proposed: 2,
      confirmed: 3,
      dismissed: 1,
      byKind: { email: 2, url: 1, ipv4: 1, domain: 1, sha256: 1 },
    });
  });

  test("returns a stable empty summary", () => {
    expect(summariseFindings([])).toEqual({
      total: 0,
      proposed: 0,
      confirmed: 0,
      dismissed: 0,
      byKind: { email: 0, url: 0, ipv4: 0, domain: 0, sha256: 0 },
    });
  });
});
