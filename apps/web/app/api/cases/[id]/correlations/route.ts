import { can } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import { getCaseCorrelations } from "@/lib/correlations/repository";
import { getRequestId, jsonResponse, requestLog } from "@/lib/http/security";
import { caseIdSchema } from "@/lib/sources/contracts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "cases:read")) return jsonResponse({ error: "Access denied." }, 403, requestId);

  const parsedId = caseIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);

  try {
    const collection = await getCaseCorrelations(parsedId.data);
    if (!collection) return jsonResponse({ error: "Case not found." }, 404, requestId);
    requestLog("info", "correlations.listed", requestId, {
      caseId: parsedId.data,
      correlationCount: collection.summary.total,
    });
    return jsonResponse(collection, 200, requestId, {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Cookie",
    });
  } catch (error) {
    requestLog("error", "correlations.list.error", requestId, {
      error: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse({ error: "Relationships could not be loaded." }, 500, requestId);
  }
}
