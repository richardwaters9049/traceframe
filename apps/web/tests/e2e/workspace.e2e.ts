import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { executeIntegrationSql } from "./integration-sql";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Traceframe!2026");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}

async function prepareTerminalFailure(
  page: import("@playwright/test").Page,
  projectName: string,
) {
  const origin = new URL(page.url()).origin;
  const title = `Synthetic retry ${projectName} ${Date.now().toString(36)}`;
  const caseResponse = await page.request.post("/api/cases", {
    headers: { Origin: origin },
    data: {
      title,
      summary: "Synthetic terminal ingestion recovery verification.",
      priority: "standard",
    },
  });
  expect(caseResponse.status(), await caseResponse.text()).toBe(201);
  const createdCase = await caseResponse.json() as { case: { id: string } };
  const uploadResponse = await page.request.post(
    `/api/cases/${createdCase.case.id}/sources`,
    {
      headers: { Origin: origin },
      multipart: {
        file: {
          name: "synthetic-terminal-failure.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(
            "Synthetic terminal failure fixture only.\nUser-Agent: TraceframeRecoveryUI/1.0",
          ),
        },
      },
    },
  );
  expect(uploadResponse.status(), await uploadResponse.text()).toBe(202);
  const source = await uploadResponse.json() as { sourceId: string };
  let observationId: string | undefined;
  await expect.poll(async () => {
    const sourcesResponse = await page.request.get(
      `/api/cases/${createdCase.case.id}/sources`,
    );
    const body = await sourcesResponse.json() as {
      sources: Array<{
        id: string;
        status: string;
        observations: Array<{ id: string; kind: string }>;
      }>;
    };
    const uploadedSource = body.sources.find((item) => item.id === source.sourceId);
    observationId = uploadedSource?.observations.find(
      (observation) => observation.kind === "user_agent",
    )?.id;
    return uploadedSource?.status;
  }, { timeout: 20_000 }).toBe("ready");
  expect(observationId).toBeTruthy();
  const findingResponse = await page.request.post(
    `/api/cases/${createdCase.case.id}/findings`,
    {
      headers: { Origin: origin },
      data: {
        observationId,
        note: "Synthetic browser fixture prepared for reviewed bundle verification.",
      },
    },
  );
  expect(findingResponse.status(), await findingResponse.text()).toBe(201);
  const finding = await findingResponse.json() as { findingId: string };
  const reviewResponse = await page.request.patch(
    `/api/cases/${createdCase.case.id}/findings/${finding.findingId}`,
    {
      headers: { Origin: origin },
      data: {
        status: "confirmed",
        rationale: "Confirmed as a synthetic recovery verification fixture.",
      },
    },
  );
  expect(reviewResponse.status(), await reviewResponse.text()).toBe(200);
  await executeIntegrationSql(`
    UPDATE ingestion_jobs
    SET status = 'failed', attempts = max_attempts,
      last_error = 'ValueError: source processing failed', updated_at = now()
    WHERE source_id = '${source.sourceId}'::uuid;
    UPDATE source_material
    SET status = 'failed', failure_reason = 'ValueError: source processing failed'
    WHERE id = '${source.sourceId}'::uuid;
  `);
  return title;
}

test("login, navigation, dialog focus, case selection, and logout are accessible", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.waitForTimeout(800);

  const dashboardResults = await new AxeBuilder({ page }).analyze();
  expect(dashboardResults.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);

  const firstPageControl = page.getByRole("button", { name: "Go to first page", exact: true });
  const lastPageControl = page.getByRole("button", { name: "Go to last page", exact: true });
  await expect(firstPageControl).toBeVisible();
  await expect(lastPageControl).toBeVisible();
  if (await lastPageControl.getAttribute("aria-disabled") !== "true") {
    await lastPageControl.click();
    await expect(lastPageControl).toHaveAttribute("aria-disabled", "true");
    await firstPageControl.click();
    await expect(firstPageControl).toHaveAttribute("aria-disabled", "true");
  }

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeHidden();
  }

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await page
      .getByRole("dialog", { name: "Workspace navigation" })
      .getByRole("button", { name: "Architecture", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: "Architecture", exact: true }).click();
  }
  await expect(page.getByRole("heading", {
    name: "Four focused services. One public boundary.",
    exact: true,
  })).toBeVisible();
  await expect(page.getByLabel("Next.js status available", { exact: true })).toBeVisible();
  await expect(page.getByLabel("PostgreSQL status available", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Python status available", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Object storage status available", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Evidence pipeline status", { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  const architectureResults = await new AxeBuilder({ page }).analyze();
  expect(architectureResults.violations.filter(
    (violation) => ["serious", "critical"].includes(violation.impact ?? ""),
  )).toEqual([]);
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await page
      .getByRole("dialog", { name: "Workspace navigation" })
      .getByRole("button", { name: "Dashboard", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  const opener = page.getByTestId("new-case-primary");
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Create a case" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Case title")).toBeFocused();
  // Backdrop-filter compositing makes axe darken the dialog itself; page-level
  // contrast is checked above, while the scoped modal scan covers other rules.
  const dialogResults = await new AxeBuilder({ page }).include('[role="dialog"]').disableRules(["color-contrast"]).analyze();
  expect(dialogResults.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  const caseRows = page.getByTestId("case-row");
  const caseRowCount = await caseRows.count();
  expect(caseRowCount).toBeLessThanOrEqual(5);
  if (caseRowCount > 0) {
    await caseRows.nth(0).click();
    const lifecycleButton = page.getByRole("button", { name: /^(Close|Reopen) case$/ });
    await expect(lifecycleButton).toBeVisible();
    await lifecycleButton.click();
    const lifecycleDialog = page.getByRole("dialog", { name: /^(Close|Reopen) this case\?$/ });
    await expect(lifecycleDialog).toBeVisible();
    await expect(lifecycleDialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    // WebKit's backdrop-filter compositing makes axe sample the dimmed page
    // through the dialog; page-level contrast is checked before the modal.
    const lifecycleResults = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .disableRules(["color-contrast"])
      .analyze();
    expect(lifecycleResults.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
    await lifecycleDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(lifecycleDialog).toBeHidden();
    await expect(lifecycleButton).toBeFocused();
    await page.getByRole("tab", { name: "analysis", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Analysis workspace" })).toBeVisible();
    await page.getByRole("tab", { name: /^sources(?: · \d+)?$/ }).click();
    await expect(page.getByRole("heading", { name: "Source material" })).toBeVisible();
    await page.getByRole("tab", { name: /^findings(?: · \d+)?$/ }).click();
    await expect(page.getByRole("heading", { name: "Analyst findings" })).toBeVisible();
    await expect(page.getByLabel("Finding summary")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bundle", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print", exact: true })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".case-print-summary")).toBeVisible();
    await expect(page.locator(".case-print-summary").getByRole("heading", { name: /Reviewed findings/ })).toBeVisible();
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("tab", { name: "relationships", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Cross-source relationships" })).toBeVisible();
    await expect(page.getByLabel("Relationship summary")).toBeVisible();
    await page.getByRole("button", { name: "Back to dashboard" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  }

  const retryCaseTitle = await prepareTerminalFailure(page, testInfo.project.name);
  await page.reload();
  const retryCaseRow = page.getByTestId("case-row").filter({
    hasText: retryCaseTitle,
  }).first();
  await expect(retryCaseRow).toBeVisible();
  await retryCaseRow.click();
  await page.getByRole("tab", { name: /^sources(?: · \d+)?$/ }).click();
  const retryIngestionButton = page.getByRole("button", {
    name: "Retry ingestion for synthetic-terminal-failure.txt",
    exact: true,
  });
  await expect(retryIngestionButton).toBeVisible();
  await retryIngestionButton.click();
  const retryDialog = page.getByRole("dialog", { name: "Retry source ingestion?", exact: true });
  await expect(retryDialog).toBeVisible();
  const retryCancelButton = retryDialog.getByRole("button", { name: "Cancel", exact: true });
  await expect(retryCancelButton).toBeFocused();
  const retryDialogResults = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .disableRules(["color-contrast"])
    .analyze();
  expect(retryDialogResults.violations.filter(
    (violation) => ["serious", "critical"].includes(violation.impact ?? ""),
  )).toEqual([]);
  await retryCancelButton.click();
  await expect(retryDialog).toBeHidden();
  await expect(retryIngestionButton).toBeFocused();
  await page.getByRole("tab", { name: /^findings(?: · \d+)?$/ }).click();
  const bundleButton = page.getByRole("button", { name: "Bundle", exact: true });
  await expect(bundleButton).toBeEnabled();
  const bundleDownload = page.waitForEvent("download");
  await bundleButton.click();
  const downloadedBundle = await bundleDownload;
  expect(downloadedBundle.suggestedFilename()).toMatch(
    /^traceframe-case-[0-9a-f-]{36}-reviewed-findings\.zip$/,
  );
  await expect(page.getByText("Verified hand-off bundle prepared.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to dashboard" }).click();

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await page.getByTestId("sign-out-mobile").click();
  } else {
    await page.getByTestId("sign-out-desktop").click();
    await expect(page.getByRole("heading", { name: "Session secured" })).toBeVisible();
  }
  await expect(page).toHaveURL(/\/$/);
});
