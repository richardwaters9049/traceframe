import { can } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import { findingExportFormats } from "@/lib/findings/contracts";
import { buildReviewedFindingExport, reviewedFindingExportToCsv } from "@/lib/findings/export";
import { getFindingExportData } from "@/lib/findings/repository";
import { getRequestId, jsonResponse, requestLog } from "@/lib/http/security";
import { caseIdSchema } from "@/lib/sources/contracts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const user = await getCurrentUser();
  if (!user) return jsonResponse({ error: "Authentication required." }, 401, requestId);
  if (!can(user, "cases:read")) return jsonResponse({ error: "Access denied." }, 403, requestId);
  const parsedId = caseIdSchema.safeParse((await params).id);
  if (!parsedId.success) return jsonResponse({ error: "Case not found." }, 404, requestId);

  const formatValue = new URL(request.url).searchParams.get("format") ?? "csv";
  if (!findingExportFormats.includes(formatValue as (typeof findingExportFormats)[number])) {
    return jsonResponse({ error: "Export format must be CSV or JSON." }, 400, requestId);
  }
  const format = formatValue as (typeof findingExportFormats)[number];

  try {
    const data = await getFindingExportData(parsedId.data);
    if (!data) return jsonResponse({ error: "Case not found." }, 404, requestId);
    const payload = buildReviewedFindingExport(data.case, data.findings);
    const body = format === "csv" ? reviewedFindingExportToCsv(payload) : JSON.stringify(payload, null, 2);
    requestLog("info", "findings.exported", requestId, {
      caseId: parsedId.data,
      format,
      reviewedFindings: payload.summary.reviewed,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="traceframe-case-${parsedId.data}-reviewed-findings.${format}"`,
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
        Pragma: "no-cache",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    requestLog("error", "findings.export.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "Reviewed findings could not be exported." }, 500, requestId);
  }
}
