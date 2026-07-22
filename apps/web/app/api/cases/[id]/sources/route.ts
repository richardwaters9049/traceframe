import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/authorization";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";
import { caseIdSchema, validateSourceUpload } from "@/lib/sources/contracts";
import { createSourceUpload, listCaseSources } from "@/lib/sources/repository";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "cases:read")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const parsedId = caseIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);
  try {
    return jsonResponse({ sources: await listCaseSources(parsedId.data) }, 200, requestId);
  } catch (error) {
    requestLog("error", "sources.list.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "Sources could not be loaded." }, 500, requestId);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "sources:create")) return jsonResponse({ error: "Access denied." }, 403, requestId);

  try {
    const { id } = await params;
    const parsedId = caseIdSchema.safeParse(id);
    if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonResponse({ error: "Choose a source file to upload." }, 400, requestId);
    requestLog("info", "sources.upload.received", requestId, { mediaType: file.type, sizeBytes: file.size });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const input = validateSourceUpload({ name: file.name, type: file.type, size: file.size, bytes });
    const sourceId = await createSourceUpload(parsedId.data, input, user);
    requestLog("info", "sources.upload.queued", requestId, { caseId: parsedId.data, sourceId, sizeBytes: file.size });
    return jsonResponse({ sourceId, status: "queued" }, 202, requestId);
  } catch (error) {
    if (error instanceof Error && error.message === "CASE_NOT_FOUND") return jsonResponse({ error: "Case not found." }, 404, requestId);
    if (error instanceof Error && error.message === "DUPLICATE_SOURCE") return jsonResponse({ error: "This source is already attached to the case." }, 409, requestId);
    if (error instanceof Error && error.message.startsWith("INVALID_")) {
      requestLog("warn", "sources.upload.rejected", requestId, { reason: error.message });
      return jsonResponse({ error: "Upload a UTF-8 TXT, LOG, CSV, or JSON file no larger than 1 MiB." }, 400, requestId);
    }
    requestLog("error", "sources.upload.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The source could not be uploaded. Please try again." }, 500, requestId);
  }
}
