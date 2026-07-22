import type { ObservationKind } from "@/lib/sources/contracts";

export const MAX_CASE_CORRELATIONS = 50;
export const MAX_CORRELATION_SOURCES = 10;

export type CorrelationSource = {
  sourceId: string;
  sourceFilename: string;
  occurrences: number;
};

export type CaseCorrelation = {
  kind: ObservationKind;
  value: string;
  sourceCount: number;
  totalOccurrences: number;
  sourcesTruncated: boolean;
  sources: CorrelationSource[];
};

export type CaseCorrelationCollection = {
  correlations: CaseCorrelation[];
  summary: {
    total: number;
    sourceLinks: number;
    byKind: Record<ObservationKind, number>;
  };
  limits: {
    correlations: number;
    sourcesPerCorrelation: number;
  };
};
