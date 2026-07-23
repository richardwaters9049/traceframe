import { can } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import { reviewFindingSchema } from "@/lib/findings/contracts";
import { reviewFinding } from "@/lib/findings/repository";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";
import { caseIdSchema } from "@/lib/sources/contracts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "findings:review")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const values = await params;
  const parsedCaseId = caseIdSchema.safeParse(values.id);
  const parsedFindingId = caseIdSchema.safeParse(values.findingId);
  if (!parsedCaseId.success || !parsedFindingId.success) return jsonResponse({ error: "Finding not found." }, 404, requestId);

  try {
    const parsed = reviewFindingSchema.safeParse(await request.json());
    if (!parsed.success) return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid review." }, 400, requestId);
    await reviewFinding(parsedCaseId.data, parsedFindingId.data, parsed.data, user);
    requestLog("info", "findings.reviewed", requestId, { caseId: parsedCaseId.data, findingId: parsedFindingId.data, status: parsed.data.status });
    return jsonResponse({ findingId: parsedFindingId.data, status: parsed.data.status }, 200, requestId);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: "Invalid JSON body." }, 400, requestId);
    if (error instanceof Error && error.message === "CASE_NOT_FOUND") return jsonResponse({ error: "Case not found." }, 404, requestId);
    if (error instanceof Error && error.message === "CASE_CLOSED") {
      return jsonResponse({ error: "Reopen the case before reviewing findings." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "FINDING_NOT_FOUND") return jsonResponse({ error: "Finding not found." }, 404, requestId);
    if (error instanceof Error && error.message === "FINDING_ALREADY_REVIEWED") return jsonResponse({ error: "This finding has already been reviewed." }, 409, requestId);
    requestLog("error", "findings.review.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The finding could not be reviewed." }, 500, requestId);
  }
}
