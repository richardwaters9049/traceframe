import { can } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import { caseIdSchema } from "@/lib/sources/contracts";
import { proposeFindingSchema } from "@/lib/findings/contracts";
import { getCaseFindings, proposeFinding } from "@/lib/findings/repository";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "cases:read")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const parsedId = caseIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);
  try {
    return jsonResponse(await getCaseFindings(parsedId.data), 200, requestId);
  } catch (error) {
    requestLog("error", "findings.list.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "Findings could not be loaded." }, 500, requestId);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "findings:create")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const parsedId = caseIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);

  try {
    const parsed = proposeFindingSchema.safeParse(await request.json());
    if (!parsed.success) return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Invalid finding." }, 400, requestId);
    const findingId = await proposeFinding(parsedId.data, parsed.data, user);
    requestLog("info", "findings.proposed", requestId, { caseId: parsedId.data, findingId });
    return jsonResponse({ findingId, status: "proposed" }, 201, requestId);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: "Invalid JSON body." }, 400, requestId);
    if (error instanceof Error && error.message === "OBSERVATION_NOT_FOUND") return jsonResponse({ error: "Observation not found." }, 404, requestId);
    if (error instanceof Error && error.message === "FINDING_EXISTS") return jsonResponse({ error: "That observation is already a finding." }, 409, requestId);
    requestLog("error", "findings.propose.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The finding could not be created." }, 500, requestId);
  }
}
