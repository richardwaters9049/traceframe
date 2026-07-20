import { cookies } from "next/headers";

import { deleteSession } from "@/lib/auth/session";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog } from "@/lib/http/security";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) return jsonResponse({ error: "Request origin is not allowed." }, 403, requestId);
  try {
    await deleteSession();
    (await cookies()).set("traceframe_skip_intro", "1", {
      httpOnly: false, sameSite: "strict", secure: process.env.AUTH_COOKIE_SECURE === "true", maxAge: 15, path: "/",
    });
    return jsonResponse({ ok: true }, 200, requestId);
  } catch (error) {
    requestLog("error", "auth.logout.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "The session could not be revoked. Please try again." }, 500, requestId);
  }
}
