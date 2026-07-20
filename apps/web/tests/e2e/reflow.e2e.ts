import { expect, test } from "@playwright/test";

test("workspace reflows without horizontal overflow at zoom-equivalent widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Reflow matrix runs once in Chromium");
  await page.goto("/");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Traceframe!2026");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // At a 1440px physical viewport these CSS widths correspond to 100%, 125%,
  // 200%, and 400% browser zoom reflow boundaries.
  for (const width of [1440, 1152, 720, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});
