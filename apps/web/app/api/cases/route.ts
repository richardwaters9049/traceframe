import { ZodError } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/authorization";
import { createCaseSchema } from "@/lib/cases/contracts";
import { createCase, listCasePage, type CasePageDirection } from "@/lib/cases/repository";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const user = await getCurrentUser();
  if (!user) {
    return jsonResponse({ error: "Authentication required." }, 401, requestId);
  }
  if (!can(user, "cases:read")) return jsonResponse({ error: "Access denied." }, 403, requestId);

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return jsonResponse({ error: "Invalid page size." }, 400, requestId);
    const direction = url.searchParams.get("direction") ?? "next";
    if (!["next", "previous", "last"].includes(direction)) return jsonResponse({ error: "Invalid pagination direction." }, 400, requestId);
    const page = await listCasePage(url.searchParams.get("cursor"), limit, direction as CasePageDirection);
    return jsonResponse(page, 200, requestId);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") return jsonResponse({ error: "Invalid pagination cursor." }, 400, requestId);
    requestLog("error", "cases.list.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "Cases could not be loaded." }, 500, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonResponse({ error: "Authentication required." }, 401, requestId);
    }
    if (!can(user, "cases:create")) return jsonResponse({ error: "Access denied." }, 403, requestId);

    const input = createCaseSchema.parse(await request.json());
    const createdCase = await createCase(input, user.email);

    return jsonResponse({ case: createdCase }, 201, requestId);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(
        {
          error: "The case details are invalid.",
          issues: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
        requestId,
      );
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "The request body is not valid JSON." }, 400, requestId);
    }

    requestLog("error", "cases.create.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The case could not be created. Please try again." }, 500, requestId);
  }
}
