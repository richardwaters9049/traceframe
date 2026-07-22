import { z } from "zod";

export const findingStatuses = ["proposed", "confirmed", "dismissed"] as const;

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
  kind: "ipv4" | "url" | "email";
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
  byKind: { email: number; url: number; ipv4: number };
};
