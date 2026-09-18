import { test, expect } from "@playwright/test";
import { signIn, openDemoProject, PM_EMAIL, TRADE_EMAIL } from "./helpers";

test.describe("Gantt", () => {
  test("PM sees draggable bars and the reschedule hint", async ({ page }) => {
    await signIn(page, PM_EMAIL);
    await openDemoProject(page);
    await page.getByRole("link", { name: "Gantt" }).click();
    await expect(page.getByText("Drag a bar to reschedule", { exact: false })).toBeVisible();
    await expect(page.locator(".cursor-grab").first()).toBeVisible();
  });

  test("Trade partner sees a read-only Gantt", async ({ page }) => {
    await signIn(page, TRADE_EMAIL);
    await openDemoProject(page);
    await page.getByRole("link", { name: "Gantt" }).click();
    // Chart renders (seeded task visible) but with no drag affordances.
    await expect(page.getByText("Site prep & excavation")).toBeVisible();
    await expect(page.getByText("Drag a bar to reschedule", { exact: false })).not.toBeVisible();
    await expect(page.locator(".cursor-grab")).toHaveCount(0);
  });
});
