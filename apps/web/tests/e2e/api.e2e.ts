import { expect, test } from "@playwright/test";

const credentials = { email: "analyst@traceframe.local", password: "Traceframe!2026" };

test("API boundaries, pagination, concurrency, revocation, and throttling", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "API boundary coverage runs once");
  const origin = "http://127.0.0.1:3000";

  expect((await request.post("/api/auth/login", { headers: { Origin: "https://untrusted.invalid" }, data: credentials })).status()).toBe(403);
  expect((await request.post("/api/auth/login", { headers: { Origin: origin, "Content-Type": "application/json" }, data: "not-json" })).status()).toBe(400);

  const login = await request.post("/api/auth/login", { headers: { Origin: origin }, data: credentials });
  expect(login.status()).toBe(200);
  expect(login.headers()["x-request-id"]).toBeTruthy();
  expect((await request.post("/api/cases", { headers: { Origin: origin }, data: { title: "x", priority: "unsupported" } })).status()).toBe(400);

  const runId = Date.now().toString(36);
  const creations = await Promise.all(Array.from({ length: 6 }, (_, index) => request.post("/api/cases", {
    headers: { Origin: origin },
    data: { title: `Concurrent synthetic ${runId}-${index}`, summary: "Synthetic concurrency verification record.", priority: "standard" },
  })));
  expect(creations.every((response) => response.status() === 201)).toBe(true);
  const firstCreation = await creations[0].json() as { case: { id: string } };

  const sourceUpload = await request.post(`/api/cases/${firstCreation.case.id}/sources`, {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: "synthetic-source.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(
          "Synthetic Traceframe observation only.\nanalyst@example.test\n192.0.2.42\nhttps://example.test/source",
        ),
      },
    },
  });
  expect(sourceUpload.status(), await sourceUpload.text()).toBe(202);
  await expect.poll(async () => {
    const response = await request.get(`/api/cases/${firstCreation.case.id}/sources`);
    const body = await response.json() as { sources: Array<{ status: string; observations: Array<{ kind: string }> }> };
    return { status: body.sources[0]?.status, kinds: body.sources[0]?.observations.map((item) => item.kind).sort() };
  }, { timeout: 20_000 }).toEqual({ status: "ready", kinds: ["email", "ipv4", "url"] });

  const sourceWorkspaceResponse = await request.get(`/api/cases/${firstCreation.case.id}`);
  expect(sourceWorkspaceResponse.status()).toBe(200);
  const sourceWorkspace = await sourceWorkspaceResponse.json() as {
    workspace: { verification: { status: string }; auditEvents: Array<{ action: string }> };
  };
  expect(sourceWorkspace.workspace.verification.status).toBe("verified");
  expect(sourceWorkspace.workspace.auditEvents.some((event) => event.action === "source.uploaded")).toBe(true);

  const pageResponse = await request.get("/api/cases?limit=2");
  expect(pageResponse.status()).toBe(200);
  const responseText = await pageResponse.text();
  expect(responseText.length).toBeLessThan(10_000);
  const casePage = JSON.parse(responseText) as { cases: unknown[]; previousCursor: string | null; nextCursor: string | null };
  expect(casePage.cases).toHaveLength(2);
  expect(casePage.previousCursor).toBeNull();
  expect(casePage.nextCursor).toBeTruthy();

  const lastPageResponse = await request.get("/api/cases?limit=5&direction=last");
  expect(lastPageResponse.status()).toBe(200);
  const lastPage = await lastPageResponse.json() as { cases: unknown[]; previousCursor: string | null; nextCursor: string | null; totalCount: number };
  expect(lastPage.cases).toHaveLength(lastPage.totalCount % 5 || Math.min(5, lastPage.totalCount));
  expect(lastPage.previousCursor).toBeTruthy();
  expect(lastPage.nextCursor).toBeNull();

  const previousPageResponse = await request.get(
    `/api/cases?limit=5&direction=previous&cursor=${encodeURIComponent(lastPage.previousCursor ?? "")}`,
  );
  expect(previousPageResponse.status()).toBe(200);
  const previousPage = await previousPageResponse.json() as { cases: unknown[]; nextCursor: string | null };
  expect(previousPage.cases).toHaveLength(5);
  expect(previousPage.nextCursor).toBeTruthy();

  const dashboardResponse = await request.get("/dashboard");
  expect(dashboardResponse.status()).toBe(200);
  expect(await dashboardResponse.text()).toContain("Chain verified");
  expect((await request.post("/api/auth/logout", { headers: { Origin: origin } })).status()).toBe(200);
  expect((await request.get("/api/cases")).status()).toBe(401);

  const unknown = { email: `unknown-${runId}@traceframe.local`, password: "NotThePassword!2026" };
  let finalStatus = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    finalStatus = (await request.post("/api/auth/login", { headers: { Origin: origin }, data: unknown })).status();
  }
  expect(finalStatus).toBe(429);
});
