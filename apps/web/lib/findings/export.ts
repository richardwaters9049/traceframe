import { createHash } from "node:crypto";

import { strToU8, zipSync } from "fflate";

import type { AuditVerification } from "@/lib/audit/verify";
import type {
  FindingProvenanceSource,
  FindingExportCase,
  FindingRecord,
  ReviewedFindingBundleManifest,
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

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

const HANDOFF_NOTE = `Traceframe reviewed-finding hand-off

This archive contains reviewed synthetic findings and a provenance manifest.
It deliberately excludes original source material and normalised source content.
Verify each file against provenance-manifest.json before relying on the hand-off.
`;

export function buildReviewedFindingBundle(
  payload: ReviewedFindingExport,
  sources: readonly FindingProvenanceSource[],
  verification: Extract<AuditVerification, { status: "verified" }>,
) {
  const reviewedJson = strToU8(`${JSON.stringify(payload, null, 2)}\n`);
  const reviewedCsv = strToU8(reviewedFindingExportToCsv(payload));
  const handoffNote = strToU8(HANDOFF_NOTE);
  const contentFiles = [
    {
      path: "reviewed-findings.json",
      mediaType: "application/json",
      bytes: reviewedJson,
    },
    {
      path: "reviewed-findings.csv",
      mediaType: "text/csv",
      bytes: reviewedCsv,
    },
    {
      path: "HANDOFF.txt",
      mediaType: "text/plain",
      bytes: handoffNote,
    },
  ];
  const referencedSourceIds = new Set(payload.findings.map((finding) => finding.sourceId));
  const referencedSources = sources.filter((source) => referencedSourceIds.has(source.id));
  const manifest: ReviewedFindingBundleManifest = {
    schemaVersion: 1,
    generatedAt: payload.exportedAt,
    case: payload.case,
    summary: {
      ...payload.summary,
      referencedSources: referencedSources.length,
    },
    verification,
    policy: {
      includesOriginalSourceMaterial: false,
      includesNormalisedSourceContent: false,
      findingStatuses: ["confirmed", "dismissed"],
    },
    contents: contentFiles.map((file) => ({
      path: file.path,
      mediaType: file.mediaType,
      sizeBytes: file.bytes.byteLength,
      sha256: sha256(file.bytes),
    })),
    sources: referencedSources.map((source) => ({ ...source })),
    findingProvenance: payload.findings.map((finding) => ({
      findingId: finding.id,
      observationId: finding.observationId,
      sourceId: finding.sourceId,
    })),
  };
  const manifestBytes = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
  const bytes = zipSync({
    "provenance-manifest.json": manifestBytes,
    ...Object.fromEntries(contentFiles.map((file) => [file.path, file.bytes])),
  }, { level: 6 });
  return { bytes, manifest };
}
