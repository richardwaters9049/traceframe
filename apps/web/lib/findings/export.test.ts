import { describe, expect, test } from "bun:test";

import type { FindingRecord } from "@/lib/findings/contracts";
import { buildReviewedFindingExport, protectSpreadsheetCell, reviewedFindingExportToCsv } from "@/lib/findings/export";

const baseFinding: FindingRecord = {
  id: "22222222-2222-4222-8222-222222222222",
  caseId: "11111111-1111-4111-8111-111111111111",
  observationId: "33333333-3333-4333-8333-333333333333",
  sourceId: "44444444-4444-4444-8444-444444444444",
  sourceFilename: "synthetic.csv",
  kind: "email",
  value: "analyst@example.test",
  occurrences: 1,
  status: "proposed",
  analystNote: "Synthetic note",
  reviewRationale: null,
  createdBy: "analyst@traceframe.local",
  reviewedBy: null,
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-22T12:00:00.000Z",
  reviewedAt: null,
};

describe("reviewed finding exports", () => {
  test("excludes proposals and summarises terminal decisions", () => {
    const payload = buildReviewedFindingExport(
      { id: baseFinding.caseId, title: "Synthetic case", status: "open", priority: "standard", createdAt: baseFinding.createdAt },
      [baseFinding, { ...baseFinding, id: "55555555-5555-4555-8555-555555555555", status: "confirmed", reviewRationale: "Verified", reviewedBy: "reviewer@example.test", reviewedAt: baseFinding.createdAt }],
      "2026-07-22T13:00:00.000Z",
    );
    expect(payload.summary).toEqual({ reviewed: 1, confirmed: 1, dismissed: 0 });
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]?.status).toBe("confirmed");
  });

  test("neutralises spreadsheet formulas and quotes CSV fields", () => {
    expect(protectSpreadsheetCell("=2+2")).toBe("'=2+2");
    expect(protectSpreadsheetCell("  @command")).toBe("'  @command");
    const payload = buildReviewedFindingExport(
      { id: baseFinding.caseId, title: "=unsafe", status: "open", priority: "standard", createdAt: baseFinding.createdAt },
      [{ ...baseFinding, status: "dismissed", value: "+formula", reviewRationale: "Not relevant", reviewedBy: "reviewer@example.test", reviewedAt: baseFinding.createdAt }],
      "2026-07-22T13:00:00.000Z",
    );
    const csv = reviewedFindingExportToCsv(payload);
    expect(csv).toContain("\"'=unsafe\"");
    expect(csv).toContain("\"'+formula\"");
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
