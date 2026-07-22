import { z } from "zod";

export const casePriorities = ["standard", "high", "critical"] as const;
export const CASE_REGISTER_PAGE_SIZE = 5;

export const createCaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be 120 characters or fewer"),
  summary: z
    .string()
    .trim()
    .max(2_000, "Summary must be 2,000 characters or fewer")
    .default(""),
  priority: z.enum(casePriorities).default("standard"),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export type CaseRecord = {
  id: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditEventRecord = {
  id: string;
  ledgerSequence: number;
  actorId: string;
  action: string;
  objectType: string;
  objectId: string;
  reason: string | null;
  eventHash: string;
  previousHash: string | null;
  createdAt: string;
};

export type CaseCursorPage = {
  cases: CaseRecord[];
  previousCursor: string | null;
  nextCursor: string | null;
  totalCount: number;
  urgentCount: number;
};
