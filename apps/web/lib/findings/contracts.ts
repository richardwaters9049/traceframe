import { z } from "zod";

import type { ObservationKind } from "@/lib/sources/contracts";

export const findingStatuses = ["proposed", "confirmed", "dismissed"] as const;
export const findingExportFormats = ["csv", "json"] as const;

export const proposeFindingSchema = z.object({
  observationId: z.string().uuid(),
  note: z.string().trim().min(3, "Add a short analyst note.").max(500, "Analyst note must be 500 characters or fewer."),
});

export const reviewFindingSchema = z.object({
  status: z.enum(["confirmed", "dismissed"]),
  rationale: z.string().trim().min(3, "Add a short review rationale.").max(500, "Review rationale must be 500 characters or fewer."),
});

export type ProposeFindingInput = z.infer<typeof proposeFindingSchema>;
export type ReviewFindingInput = z.infer<typeof reviewFindingSchema>;

export type FindingRecord = {
  id: string;
  caseId: string;
  observationId: string;
  sourceId: string;
  sourceFilename: string;
  kind: ObservationKind;
  value: string;
  occurrences: number;
  status: (typeof findingStatuses)[number];
  analystNote: string;
  reviewRationale: string | null;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

export type FindingSummary = {
  total: number;
  proposed: number;
  confirmed: number;
  dismissed: number;
  byKind: Record<ObservationKind, number>;
};

export type FindingExportCase = {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
};

export type ReviewedFindingRecord = FindingRecord & {
  status: "confirmed" | "dismissed";
  reviewRationale: string;
  reviewedBy: string;
  reviewedAt: string;
};

export type ReviewedFindingExport = {
  schemaVersion: 1;
  exportedAt: string;
  case: FindingExportCase;
  summary: { reviewed: number; confirmed: number; dismissed: number };
  findings: ReviewedFindingRecord[];
};
