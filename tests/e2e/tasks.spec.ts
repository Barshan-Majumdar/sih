import { test, expect, type Page } from "@playwright/test";
import { signIn, openDemoProject, PM_EMAIL } from "./helpers";

// One flow, one browser session: create → status change → roadblock flag/resolve → delete.
// The test creates its own task and deletes it, leaving the demo data untouched.
test.describe("Task lifecycle", () => {
  const taskName = `E2E Task ${Date.now()}`;

  async function taskRow(page: Page) {
    return page.getByRole("row").filter({ hasText: taskName });
  }

  test("create, update status, flag + resolve roadblock, delete", async ({ page }) => {
    await signIn(page, PM_EMAIL);
    await openDemoProject(page);

    // Create
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByPlaceholder("Task name").fill(taskName);
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill("2026-08-03");
    await dateInputs.nth(1).fill("2026-08-07");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("link", { name: taskName })).toBeVisible();

    // Status change persists
    const row = await taskRow(page);
    await row.locator("select").selectOption("IN_PROGRESS");
    await page.waitForTimeout(1500); // allow server action + revalidate
    await page.reload();
    await expect((await taskRow(page)).locator("select")).toHaveValue("IN_PROGRESS");

    // Flag a roadblock
    await (await taskRow(page)).getByRole("button", { name: "Flag roadblock" }).click();
    await page.getByPlaceholder("What's blocking this task?").fill("E2E test roadblock");
    await page.getByRole("button", { name: "Flag", exact: true }).click();
    await expect((await taskRow(page)).getByText("Roadblock", { exact: true })).toBeVisible();

    // Resolve it
    await (await taskRow(page)).getByRole("button", { name: "Resolve" }).click();
    await expect((await taskRow(page)).getByText("Resolved", { exact: true })).toBeVisible();

    // Delete (cleanup is part of the assertion)
    await (await taskRow(page)).getByRole("button", { name: `Delete ${taskName}` }).click();
    await expect(page.getByRole("link", { name: taskName })).not.toBeVisible();
  });
});
