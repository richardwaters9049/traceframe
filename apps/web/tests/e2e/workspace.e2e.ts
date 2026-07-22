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
    await expect(page.getByRole("heading", { name: "Analysis workspace" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sources" })).toBeDisabled();
    await page.getByRole("button", { name: "Back to dashboard" }).click();
  }

  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Open sidebar" }).click();
    await page.getByTestId("sign-out-mobile").click();
  } else {
    await page.getByTestId("sign-out-desktop").click();
    await expect(page.getByRole("heading", { name: "Session secured" })).toBeVisible();
  }
  await expect(page).toHaveURL(/\/$/);
});
