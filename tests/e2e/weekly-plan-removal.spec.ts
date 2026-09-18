import { expect, test } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("future commitments can be removed and restored, but completed commitments stay protected", async ({ page }) => {
  test.setTimeout(120_000);
  const taskName = `E2E removable commitment ${Date.now()}`;

  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  const projectId = new URL(page.url()).pathname.split("/")[2];

  try {
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page.getByPlaceholder("Task name").fill(taskName);
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill("2026-09-14");
    await dateInputs.nth(1).fill("2026-09-18");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("link", { name: taskName })).toBeVisible();

    await page.goto(`/projects/${projectId}/weekly-plan?week=2026-09-14`);
    await page.locator("select").last().selectOption({ label: taskName });
    await page.getByRole("button", { name: "Commit", exact: true }).click();

    let row = page.getByRole("row").filter({ hasText: taskName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: `Remove ${taskName} from this weekly plan` }).click();
    await row.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(row).not.toBeVisible();
    await expect(page.locator("select").last().locator("option", { hasText: taskName })).toHaveCount(1);

    await page.locator("select").last().selectOption({ label: taskName });
    await page.getByRole("button", { name: "Commit", exact: true }).click();
    row = page.getByRole("row").filter({ hasText: taskName });
    await expect(row).toBeVisible();
    await expect(row.locator("select")).toHaveValue("COMMITTED");

    await row.locator("select").selectOption("COMPLETED");
    await page.reload();
    row = page.getByRole("row").filter({ hasText: taskName });
    await expect(row.locator("select")).toHaveValue("COMPLETED");
    await expect(row.getByRole("button", { name: `Remove ${taskName} from this weekly plan` })).toHaveCount(0);
  } finally {
    await page.goto(`/projects/${projectId}`);
    const taskRow = page.getByRole("row").filter({ hasText: taskName });
    if (await taskRow.count()) {
      await taskRow.getByRole("button", { name: `Delete ${taskName}` }).click();
    }
  }
});
