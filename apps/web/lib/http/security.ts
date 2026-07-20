import "server-only";

import { createHash, randomUUID } from "node:crypto";

export function getRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{8,128}$/.test(supplied) ? supplied : randomUUID();
}

export function requestLog(level: "info" | "warn" | "error", event: string, requestId: string, details: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ level, event, requestId, ...details });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const expected = forwardedHost
      ? `${forwardedProto ?? requestUrl.protocol.replace(":", "")}://${forwardedHost}`
      : requestUrl.origin;
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

export function throttleIdentity(request: Request, normalisedEmail: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const networkIdentity = forwarded || request.headers.get("x-real-ip") || "local";
  const secret = process.env.AUTH_THROTTLE_SECRET || "traceframe-local-throttle";
  return createHash("sha256").update(`${secret}\0${normalisedEmail}\0${networkIdentity}`).digest("hex");
}

export function jsonResponse(data: unknown, status: number, requestId: string, headers?: HeadersInit) {
  return Response.json(data, { status, headers: { "x-request-id": requestId, ...headers } });
}
