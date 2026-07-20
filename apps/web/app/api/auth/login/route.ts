import { ZodError } from "zod";

import { loginSchema } from "@/lib/auth/contracts";
import { authenticateUser, createSession } from "@/lib/auth/session";
import { applyProgressiveDelay, checkLoginThrottle, clearLoginThrottle, recordLoginFailure } from "@/lib/auth/throttle";
import { getRequestId, isSameOriginRequest, jsonResponse, requestLog, throttleIdentity } from "@/lib/http/security";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (!isSameOriginRequest(request)) {
    requestLog("warn", "auth.login.cross_origin_rejected", requestId);
    return jsonResponse({ error: "Sign in failed." }, 403, requestId);
  }

  try {
    const credentials = loginSchema.parse(await request.json());
    const identityHash = throttleIdentity(request, credentials.email);
    const throttle = await checkLoginThrottle(identityHash);
    await applyProgressiveDelay(throttle.delayMs);
    if (throttle.blocked) {
      requestLog("warn", "auth.login.throttled", requestId);
      return jsonResponse({ error: "Email or password is incorrect." }, 429, requestId, { "Retry-After": "60" });
    }
    const user = await authenticateUser(credentials.email, credentials.password);

    if (!user) {
      await recordLoginFailure(identityHash);
      requestLog("warn", "auth.login.failed", requestId);
      return jsonResponse({ error: "Email or password is incorrect." }, 401, requestId);
    }

    await clearLoginThrottle(identityHash);
    await createSession(user.id);
    requestLog("info", "auth.login.succeeded", requestId, { userId: user.id });
    return jsonResponse({ user }, 200, requestId);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return jsonResponse({ error: "Enter a valid email address and password." }, 400, requestId);
    }

    requestLog("error", "auth.login.error", requestId, { error: error instanceof Error ? error.name : "unknown" });
    return jsonResponse({ error: "Traceframe could not sign you in. Please try again." }, 500, requestId);
  }
}
