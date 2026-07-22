import {
  MAX_CASE_CORRELATIONS,
  MAX_CORRELATION_SOURCES,
  type CaseCorrelation,
  type CaseCorrelationCollection,
} from "@/lib/correlations/contracts";
import type { ObservationKind } from "@/lib/sources/contracts";

export type CorrelationRow = {
  kind: ObservationKind;
  value: string;
  source_count: number;
  total_occurrences: number;
  source_id: string;
  original_filename: string;
  occurrences: number;
};

export function serialiseCorrelations(rows: CorrelationRow[]): CaseCorrelationCollection {
  const correlations: CaseCorrelation[] = [];
  const byKey = new Map<string, CaseCorrelation>();

  for (const row of rows) {
    const key = `${row.kind}\0${row.value}`;
    let correlation = byKey.get(key);
    if (!correlation) {
      correlation = {
        kind: row.kind,
        value: row.value,
        sourceCount: row.source_count,
        totalOccurrences: row.total_occurrences,
        sourcesTruncated: row.source_count > MAX_CORRELATION_SOURCES,
        sources: [],
      };
      byKey.set(key, correlation);
      correlations.push(correlation);
    }
    correlation.sources.push({
      sourceId: row.source_id,
      sourceFilename: row.original_filename,
      occurrences: row.occurrences,
    });
  }

  const byKind: CaseCorrelationCollection["summary"]["byKind"] = {
    email: 0,
    url: 0,
    ipv4: 0,
    domain: 0,
    sha256: 0,
  };
  for (const correlation of correlations) byKind[correlation.kind] += 1;

  return {
    correlations,
    summary: {
      total: correlations.length,
      sourceLinks: correlations.reduce((total, item) => total + item.sourceCount, 0),
      byKind,
    },
    limits: {
      correlations: MAX_CASE_CORRELATIONS,
      sourcesPerCorrelation: MAX_CORRELATION_SOURCES,
    },
  };
}
