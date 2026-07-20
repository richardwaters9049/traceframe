"use client";

export type ApiResult<T> = { ok: true; data: T; requestId: string | null } | { ok: false; status: number; error: string; requestId: string | null };

export async function apiRequest<T>(input: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<ApiResult<T>> {
  const timeout = new AbortController();
  const external = init.signal;
  const abortFromExternal = () => timeout.abort(external?.reason);
  external?.addEventListener("abort", abortFromExternal, { once: true });
  const timer = window.setTimeout(() => timeout.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: timeout.signal, headers: { Accept: "application/json", ...init.headers } });
    const requestId = response.headers.get("x-request-id");
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await response.json() as unknown : null;
    if (!response.ok) {
      const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error : `Request failed with status ${response.status}.`;
      return { ok: false, status: response.status, error: message, requestId };
    }
    return { ok: true, data: body as T, requestId };
  } catch (error) {
    const message = error instanceof DOMException && error.name === "TimeoutError"
      ? "The request timed out. Please try again." : "Traceframe could not reach the server. Please try again.";
    return { ok: false, status: 0, error: message, requestId: null };
  } finally {
    window.clearTimeout(timer);
    external?.removeEventListener("abort", abortFromExternal);
  }
}
