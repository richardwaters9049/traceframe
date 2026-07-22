import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/authorization";
import { getCaseWorkspace } from "@/lib/cases/repository";
import { getRequestId, jsonResponse, requestLog } from "@/lib/http/security";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "cases:read")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return jsonResponse({ error: "Case not found." }, 404, requestId);
  }
  try {
    const workspace = await getCaseWorkspace(id);
    return workspace ? jsonResponse({ workspace: {
      ...workspace,
      capabilities: {
        canCreateFindings: can(user, "findings:create"),
        canReviewFindings: can(user, "findings:review"),
      },
    } }, 200, requestId) : jsonResponse({ error: "Case not found." }, 404, requestId);
  } catch (error) {
    requestLog("error", "cases.workspace.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The case workspace could not be loaded." }, 500, requestId);
  }
}
