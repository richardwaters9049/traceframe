import { can } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";
import { caseIdSchema, sourceIdSchema } from "@/lib/sources/contracts";
import { retrySourceIngestion } from "@/lib/sources/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  }
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "sources:retry")) {
    return jsonResponse({ error: "Access denied." }, 403, requestId);
  }

  const values = await params;
  const parsedCaseId = caseIdSchema.safeParse(values.id);
  const parsedSourceId = sourceIdSchema.safeParse(values.sourceId);
  if (!parsedCaseId.success || !parsedSourceId.success) {
    return jsonResponse({ error: "Source not found." }, 404, requestId);
  }

  try {
    const result = await retrySourceIngestion(parsedCaseId.data, parsedSourceId.data, user);
    requestLog("info", "sources.ingestion.retried", requestId, {
      caseId: parsedCaseId.data,
      sourceId: parsedSourceId.data,
    });
    return jsonResponse(result, 202, requestId);
  } catch (error) {
    if (error instanceof Error && error.message === "CASE_NOT_FOUND") {
      return jsonResponse({ error: "Case not found." }, 404, requestId);
    }
    if (error instanceof Error && error.message === "SOURCE_NOT_FOUND") {
      return jsonResponse({ error: "Source not found." }, 404, requestId);
    }
    if (error instanceof Error && error.message === "CASE_CLOSED") {
      return jsonResponse({ error: "Reopen the case before retrying source ingestion." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "SOURCE_NOT_FAILED") {
      return jsonResponse({ error: "Only terminal ingestion failures can be retried." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "SOURCE_ORIGINAL_UNAVAILABLE") {
      return jsonResponse({ error: "The retained original is required for another attempt." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "INGESTION_JOB_NOT_FOUND") {
      return jsonResponse({ error: "The ingestion job is unavailable for recovery." }, 409, requestId);
    }
    requestLog("error", "sources.ingestion.retry.error", requestId, {
      error: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "Source ingestion could not be retried." }, 500, requestId);
  }
}
