import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Traceframe!2026");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}

test("login, navigation, dialog focus, case selection, and logout are accessible", async ({ page }, testInfo) => {
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

  let reviewedCaseRow = page.getByTestId("case-row").filter({
    hasText: /Concurrent synthetic .+-0/,
  }).first();
  if (await reviewedCaseRow.count() === 0) {
    await page.getByRole("button", { name: "Go to next page", exact: true }).click();
    reviewedCaseRow = page.getByTestId("case-row").filter({
      hasText: /Concurrent synthetic .+-0/,
    }).first();
  }
  await expect(reviewedCaseRow).toBeVisible();
  await reviewedCaseRow.click();
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
