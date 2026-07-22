import type {
  FindingExportCase,
  FindingRecord,
  ReviewedFindingExport,
  ReviewedFindingRecord,
} from "@/lib/findings/contracts";

export function isReviewedFinding(finding: FindingRecord): finding is ReviewedFindingRecord {
  return finding.status !== "proposed"
    && finding.reviewRationale !== null
    && finding.reviewedBy !== null
    && finding.reviewedAt !== null;
}

export function buildReviewedFindingExport(
  caseRecord: FindingExportCase,
  findings: readonly FindingRecord[],
  exportedAt = new Date().toISOString(),
): ReviewedFindingExport {
  const reviewed = findings.filter(isReviewedFinding);
  return {
    schemaVersion: 1,
    exportedAt,
    case: caseRecord,
    summary: {
      reviewed: reviewed.length,
      confirmed: reviewed.filter((finding) => finding.status === "confirmed").length,
      dismissed: reviewed.filter((finding) => finding.status === "dismissed").length,
    },
    findings: reviewed,
  };
}

export function protectSpreadsheetCell(value: string) {
  return /^[\t\r]|^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null) {
  const protectedValue = protectSpreadsheetCell(value === null ? "" : String(value));
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function reviewedFindingExportToCsv(payload: ReviewedFindingExport) {
  const headers = [
    "case_id", "case_title", "finding_id", "status", "indicator_type", "indicator_value",
    "occurrences", "source_filename", "analyst_note", "created_by", "created_at",
    "review_rationale", "reviewed_by", "reviewed_at",
  ];
  const rows = payload.findings.map((finding) => [
    payload.case.id,
    payload.case.title,
    finding.id,
    finding.status,
    finding.kind,
    finding.value,
    finding.occurrences,
    finding.sourceFilename,
    finding.analystNote,
    finding.createdBy,
    finding.createdAt,
    finding.reviewRationale,
    finding.reviewedBy,
    finding.reviewedAt,
  ].map(csvCell).join(","));
  return `\uFEFF${headers.map(csvCell).join(",")}\r\n${rows.length ? `${rows.join("\r\n")}\r\n` : ""}`;
}
