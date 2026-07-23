import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/authorization";
import { updateCaseStatusSchema } from "@/lib/cases/contracts";
import { getCaseWorkspace, updateCaseStatus } from "@/lib/cases/repository";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";
import { caseIdSchema } from "@/lib/sources/contracts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "cases:read")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const parsedId = caseIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);
  try {
    const workspace = await getCaseWorkspace(parsedId.data);
    return workspace ? jsonResponse({ workspace: {
      ...workspace,
      capabilities: {
        canManageCase: can(user, "cases:update"),
        canCreateFindings: can(user, "findings:create"),
        canReviewFindings: can(user, "findings:review"),
      },
    } }, 200, requestId) : jsonResponse({ error: "Case not found." }, 404, requestId);
  } catch (error) {
    requestLog("error", "cases.workspace.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The case workspace could not be loaded." }, 500, requestId);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "cases:update")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const parsedId = caseIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);

  try {
    const parsed = updateCaseStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid case status." }, 400, requestId);
    }
    const record = await updateCaseStatus(parsedId.data, parsed.data, user.email);
    requestLog("info", "cases.status.updated", requestId, { caseId: record.id, status: record.status });
    return jsonResponse({ case: record }, 200, requestId);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: "Invalid JSON body." }, 400, requestId);
    if (error instanceof Error && error.message === "CASE_NOT_FOUND") {
      return jsonResponse({ error: "Case not found." }, 404, requestId);
    }
    if (error instanceof Error && error.message === "CASE_STATUS_UNCHANGED") {
      return jsonResponse({ error: "The case is already in that state." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "CASE_HAS_ACTIVE_SOURCES") {
      return jsonResponse({ error: "Wait for all source processing to finish before closing the case." }, 409, requestId);
    }
    if (error instanceof Error && error.message === "CASE_HAS_PROPOSED_FINDINGS") {
      return jsonResponse({ error: "Review every proposed finding before closing the case." }, 409, requestId);
    }
    requestLog("error", "cases.status.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The case status could not be updated." }, 500, requestId);
  }
}
