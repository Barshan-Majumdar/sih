import { test, expect } from "@playwright/test";
import { signIn, openDemoProject, PM_EMAIL } from "./helpers";

// Creates its own task, commits it to the current week, completes the
// commitment, then deletes the task (cascading the commitment away) so the
// seeded demo data stays pristine.
test.describe("Weekly Work Plan", () => {
  const taskName = `E2E Commit ${Date.now()}`;

  test("commit a task, mark it complete, PPC appears", async ({ page }) => {
    await signIn(page, PM_EMAIL);
    await openDemoProject(page);

    // Create the disposable task
    await page.getByRole("button", { name: "+ Add Task" }).click();
    await page.getByPlaceholder("Task name").fill(taskName);
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill("2026-08-10");
    await dateInputs.nth(1).fill("2026-08-14");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("link", { name: taskName })).toBeVisible();

    // Commit it to this week
    await page.getByRole("link", { name: "Weekly Plan" }).click();
    await expect(page.getByText("Commit a task to this week")).toBeVisible();
    await page.locator("select").last().selectOption({ label: taskName });
    await page.getByRole("button", { name: "Commit", exact: true }).click();

    const commitmentRow = page.getByRole("row").filter({ hasText: taskName });
    await expect(commitmentRow).toBeVisible();
    await expect(commitmentRow.locator("select")).toHaveValue("COMMITTED");

    // Mark completed; PPC card should be visible
    await commitmentRow.locator("select").selectOption("COMPLETED");
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: taskName }).locator("select")).toHaveValue("COMPLETED");
    await expect(page.getByText("PPC", { exact: true })).toBeVisible();

    // Cleanup: delete the task (cascades the commitment)
    await page.getByRole("link", { name: "Tasks", exact: true }).click();
    await page.getByRole("row").filter({ hasText: taskName }).getByRole("button", { name: `Delete ${taskName}` }).click();
    await expect(page.getByRole("link", { name: taskName })).not.toBeVisible();
  });
});
