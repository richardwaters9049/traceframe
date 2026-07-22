import type { CaseRecord } from "@/lib/cases/contracts";
import type { FindingRecord, FindingSummary, ReviewedFindingRecord } from "@/lib/findings/contracts";

function printableDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function CasePrintSummary({
  record,
  summary,
  findings,
}: {
  record: CaseRecord;
  summary: FindingSummary;
  findings: FindingRecord[];
}) {
  const reviewedFindings = findings.filter((finding): finding is ReviewedFindingRecord =>
    finding.status !== "proposed"
    && finding.reviewRationale !== null
    && finding.reviewedBy !== null
    && finding.reviewedAt !== null);

  return (
    <section className="case-print-summary hidden">
      <header className="case-print-header">
        <div><p className="case-print-brand">Traceframe.</p><p>Synthetic case summary</p></div>
        <p>Opened {printableDate(record.createdAt)}</p>
      </header>
      <h1>{record.title}</h1>
      <p className="case-print-context">{record.summary || "No initial context was recorded for this case."}</p>
      <dl className="case-print-metadata">
        <div><dt>Status</dt><dd>{record.status}</dd></div>
        <div><dt>Priority</dt><dd>{record.priority}</dd></div>
        <div><dt>Reviewed findings</dt><dd>{reviewedFindings.length}</dd></div>
        <div><dt>Pending review</dt><dd>{summary.proposed}</dd></div>
      </dl>
      <div className="case-print-section-heading"><h2>Reviewed findings</h2><p>{summary.confirmed} confirmed · {summary.dismissed} dismissed</p></div>
      {reviewedFindings.length ? reviewedFindings.map((finding) => (
        <article key={finding.id} className="case-print-finding">
          <div className="case-print-finding-heading"><div><p>{finding.kind.toUpperCase()} · {finding.sourceFilename}</p><h3>{finding.value}{finding.occurrences > 1 ? ` ×${finding.occurrences}` : ""}</h3></div><strong>{finding.status}</strong></div>
          <dl>
            <div><dt>Analyst note</dt><dd>{finding.analystNote}</dd></div>
            <div><dt>Review rationale</dt><dd>{finding.reviewRationale}</dd></div>
            <div><dt>Reviewed by</dt><dd>{finding.reviewedBy} · {printableDate(finding.reviewedAt)}</dd></div>
          </dl>
        </article>
      )) : <p className="case-print-empty">No findings have reached a terminal review decision.</p>}
      <footer>Generated from synthetic Traceframe data. Original source content is not included.</footer>
    </section>
  );
}
