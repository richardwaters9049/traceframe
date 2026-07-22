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
  const syntheticHash = "a".repeat(64);
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
          `Synthetic Traceframe observation only.\nanalyst@example.test\n192.0.2.42\nhttps://example.test/source\n${syntheticHash}`,
        ),
      },
    },
  });
  expect(sourceUpload.status(), await sourceUpload.text()).toBe(202);
  await expect.poll(async () => {
    const response = await request.get(`/api/cases/${firstCreation.case.id}/sources`);
    const body = await response.json() as { sources: Array<{ status: string; observations: Array<{ kind: string }> }> };
    return { status: body.sources[0]?.status, kinds: body.sources[0]?.observations.map((item) => item.kind).sort() };
  }, { timeout: 20_000 }).toEqual({ status: "ready", kinds: ["domain", "email", "ipv4", "sha256", "url"] });

  const sourcesResponse = await request.get(`/api/cases/${firstCreation.case.id}/sources`);
  const sourcesBody = await sourcesResponse.json() as {
    sources: Array<{ observations: Array<{ id: string; kind: string }> }>;
  };
  const observationId = sourcesBody.sources[0]?.observations.find((item) => item.kind === "ipv4")?.id;
  expect(observationId).toBeTruthy();

  expect((await request.post(`/api/cases/${firstCreation.case.id}/findings`, {
    headers: { Origin: "https://untrusted.invalid" },
    data: { observationId, note: "Synthetic address requires analyst review." },
  })).status()).toBe(403);
  const proposalResponse = await request.post(`/api/cases/${firstCreation.case.id}/findings`, {
    headers: { Origin: origin },
    data: { observationId, note: "Synthetic address requires analyst review." },
  });
  expect(proposalResponse.status()).toBe(201);
  const proposal = await proposalResponse.json() as { findingId: string };
  expect((await request.post(`/api/cases/${firstCreation.case.id}/findings`, {
    headers: { Origin: origin },
    data: { observationId, note: "Duplicate proposal." },
  })).status()).toBe(409);
  expect((await request.patch(`/api/cases/${firstCreation.case.id}/findings/${proposal.findingId}`, {
    headers: { Origin: origin }, data: { status: "confirmed", rationale: "No" },
  })).status()).toBe(400);
  expect((await request.patch(`/api/cases/${firstCreation.case.id}/findings/${proposal.findingId}`, {
    headers: { Origin: origin },
    data: { status: "confirmed", rationale: "Confirmed as relevant synthetic evidence." },
  })).status()).toBe(200);
  expect((await request.patch(`/api/cases/${firstCreation.case.id}/findings/${proposal.findingId}`, {
    headers: { Origin: origin },
    data: { status: "dismissed", rationale: "Attempting a second review decision." },
  })).status()).toBe(409);

  const findingCollectionResponse = await request.get(`/api/cases/${firstCreation.case.id}/findings`);
  expect(findingCollectionResponse.status()).toBe(200);
  const findingCollection = await findingCollectionResponse.json() as {
    findings: Array<{ id: string; status: string }>;
    summary: { total: number; proposed: number; confirmed: number; dismissed: number; byKind: Record<string, number> };
  };
  expect(findingCollection.findings).toContainEqual(expect.objectContaining({ id: proposal.findingId, status: "confirmed" }));
  expect(findingCollection.summary).toEqual({
    total: 1,
    proposed: 0,
    confirmed: 1,
    dismissed: 0,
    byKind: { email: 0, url: 0, ipv4: 1, domain: 0, sha256: 0 },
  });

  const sourceWorkspaceResponse = await request.get(`/api/cases/${firstCreation.case.id}`);
  expect(sourceWorkspaceResponse.status()).toBe(200);
  const sourceWorkspace = await sourceWorkspaceResponse.json() as {
    workspace: {
      verification: { status: string };
      auditEvents: Array<{ action: string }>;
      findings: Array<{ id: string; status: string; analystNote: string; reviewRationale: string | null }>;
      findingSummary: { total: number; proposed: number; confirmed: number; dismissed: number };
    };
  };
  expect(sourceWorkspace.workspace.verification.status).toBe("verified");
  expect(sourceWorkspace.workspace.auditEvents.some((event) => event.action === "source.uploaded")).toBe(true);
  expect(sourceWorkspace.workspace.auditEvents.some((event) => event.action === "finding.proposed")).toBe(true);
  expect(sourceWorkspace.workspace.auditEvents.some((event) => event.action === "finding.confirmed")).toBe(true);
  expect(sourceWorkspace.workspace.findings).toContainEqual(expect.objectContaining({
    id: proposal.findingId,
    status: "confirmed",
    analystNote: "Synthetic address requires analyst review.",
    reviewRationale: "Confirmed as relevant synthetic evidence.",
  }));
  expect(sourceWorkspace.workspace.findingSummary).toEqual(expect.objectContaining({
    total: 1, proposed: 0, confirmed: 1, dismissed: 0,
  }));

  expect((await request.get(`/api/cases/${firstCreation.case.id}/findings/export?format=pdf`)).status()).toBe(400);
  const csvExportResponse = await request.get(`/api/cases/${firstCreation.case.id}/findings/export?format=csv`);
  expect(csvExportResponse.status()).toBe(200);
  expect(csvExportResponse.headers()["cache-control"]).toContain("no-store");
  expect(csvExportResponse.headers()["content-disposition"]).toContain(`traceframe-case-${firstCreation.case.id}-reviewed-findings.csv`);
  expect(csvExportResponse.headers()["x-content-type-options"]).toBe("nosniff");
  const csvExport = await csvExportResponse.text();
  expect(csvExport.startsWith("\uFEFF")).toBe(true);
  expect(csvExport).toContain('"confirmed"');
  expect(csvExport).not.toContain('"proposed"');

  const jsonExportResponse = await request.get(`/api/cases/${firstCreation.case.id}/findings/export?format=json`);
  expect(jsonExportResponse.status()).toBe(200);
  const jsonExport = await jsonExportResponse.json() as {
    schemaVersion: number;
    case: { id: string };
    summary: { reviewed: number; confirmed: number; dismissed: number };
    findings: Array<{ status: string; reviewRationale: string }>;
  };
  expect(jsonExport).toEqual(expect.objectContaining({
    schemaVersion: 1,
    case: expect.objectContaining({ id: firstCreation.case.id }),
    summary: { reviewed: 1, confirmed: 1, dismissed: 0 },
  }));
  expect(jsonExport.findings).toContainEqual(expect.objectContaining({
    status: "confirmed",
    reviewRationale: "Confirmed as relevant synthetic evidence.",
  }));

  const secondSourceUpload = await request.post(`/api/cases/${firstCreation.case.id}/sources`, {
    headers: { Origin: origin },
    multipart: {
      file: {
        name: "synthetic-related-source.log",
        mimeType: "text/plain",
        buffer: Buffer.from(
          `Related synthetic record only.\nresponder@example.test\n192.0.2.42\nexample.test\n${syntheticHash}`,
        ),
      },
    },
  });
  expect(secondSourceUpload.status(), await secondSourceUpload.text()).toBe(202);
  await expect.poll(async () => {
    const response = await request.get(`/api/cases/${firstCreation.case.id}/sources`);
    const body = await response.json() as { sources: Array<{ status: string }> };
    return { count: body.sources.length, statuses: body.sources.map((source) => source.status) };
  }, { timeout: 20_000 }).toEqual({ count: 2, statuses: ["ready", "ready"] });

  const correlationResponse = await request.get(`/api/cases/${firstCreation.case.id}/correlations`);
  expect(correlationResponse.status()).toBe(200);
  expect(correlationResponse.headers()["cache-control"]).toContain("no-store");
  const correlationCollection = await correlationResponse.json() as {
    correlations: Array<{ kind: string; value: string; sourceCount: number; totalOccurrences: number; sources: unknown[] }>;
    summary: { total: number; sourceLinks: number; byKind: Record<string, number> };
    limits: { correlations: number; sourcesPerCorrelation: number };
  };
  expect(correlationCollection.summary).toEqual({
    total: 3,
    sourceLinks: 6,
    byKind: { email: 0, url: 0, ipv4: 1, domain: 1, sha256: 1 },
  });
  expect(correlationCollection.correlations).toContainEqual(expect.objectContaining({
    kind: "domain",
    value: "example.test",
    sourceCount: 2,
    totalOccurrences: 4,
    sources: expect.arrayContaining([expect.objectContaining({ sourceFilename: "synthetic-source.txt" })]),
  }));
  expect(correlationCollection.correlations).toContainEqual(expect.objectContaining({
    kind: "ipv4",
    value: "192.0.2.42",
    sourceCount: 2,
    totalOccurrences: 2,
  }));
  expect(correlationCollection.correlations).toContainEqual(expect.objectContaining({
    kind: "sha256",
    value: syntheticHash,
    sourceCount: 2,
    totalOccurrences: 2,
  }));

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
  expect((await request.get(`/api/cases/${firstCreation.case.id}/findings/export`)).status()).toBe(401);
  expect((await request.get(`/api/cases/${firstCreation.case.id}/correlations`)).status()).toBe(401);

  const unknown = { email: `unknown-${runId}@traceframe.local`, password: "NotThePassword!2026" };
  let finalStatus = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    finalStatus = (await request.post("/api/auth/login", { headers: { Origin: origin }, data: unknown })).status();
  }
  expect(finalStatus).toBe(429);
});
