import type { FindingRecord, FindingSummary } from "@/lib/findings/contracts";

export function summariseFindings(findings: ReadonlyArray<Pick<FindingRecord, "status" | "kind">>): FindingSummary {
  const summary: FindingSummary = {
    total: findings.length,
    proposed: 0,
    confirmed: 0,
    dismissed: 0,
    byKind: { email: 0, url: 0, ipv4: 0 },
  };

  for (const finding of findings) {
    summary[finding.status] += 1;
    summary.byKind[finding.kind] += 1;
  }
  return summary;
}
