import { can } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";
import { caseIdSchema, sourceIdSchema } from "@/lib/sources/contracts";
import { requestSourceDisposal } from "@/lib/sources/repository";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  }
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "sources:dispose")) {
    return jsonResponse({ error: "Access denied." }, 403, requestId);
  }

  const values = await params;
  const parsedCaseId = caseIdSchema.safeParse(values.id);
  const parsedSourceId = sourceIdSchema.safeParse(values.sourceId);
  if (!parsedCaseId.success || !parsedSourceId.success) {
    return jsonResponse({ error: "Source not found." }, 404, requestId);
  }

  try {
    const result = await requestSourceDisposal(parsedCaseId.data, parsedSourceId.data, user);
    requestLog("info", "sources.disposal.queued", requestId, {
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
      return jsonResponse({ error: "Reopen the case before disposing source material." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "SOURCE_PROCESSING") {
      return jsonResponse({ error: "Wait for source processing to finish before disposal." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "SOURCE_DISPOSAL_PENDING") {
      return jsonResponse({ error: "Source disposal is already queued." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "SOURCE_ALREADY_DISPOSED") {
      return jsonResponse({ error: "The original source has already been disposed." }, 409, requestId);
    }
    requestLog("error", "sources.disposal.error", requestId, {
      error: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "Source disposal could not be queued." }, 500, requestId);
  }
}
