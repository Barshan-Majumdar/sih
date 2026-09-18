import { expect, test } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("AI weekly commitments apply to the requested week and retain variance reasons", async ({ page }) => {
  test.setTimeout(150_000);
  const taskName = `E2E AI commitment ${Date.now()}`;
  const week = "2026-09-07";

  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  const projectPath = new URL(page.url()).pathname;

  try {
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByPlaceholder("Task name").fill(taskName);
    const dateInputs = page.locator('form input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    await dateInputs.nth(0).fill("2026-09-07");
    await dateInputs.nth(1).fill("2026-09-11");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("link", { name: taskName })).toBeVisible();

    await page.getByRole("button", { name: "Open Agent" }).click();
    let dialog = page.getByRole("dialog", { name: "Agent" });
    await dialog.getByRole("button", { name: "Start new conversation" }).click();
    await dialog.getByLabel("Message Agent").fill(`Commit ${taskName} for week of ${week}`);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    let proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: taskName });
    await expect(proposal.getByText("Commit task", { exact: false })).toBeVisible({ timeout: 30_000 });
    const commitResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    const commitResponse = await commitResponsePromise;
    expect(commitResponse.ok()).toBe(true);
    expect((await commitResponse.json()).proposal.status).toBe("CONFIRMED");
    await proposal.getByRole("link", { name: "Open weekly plan" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/weekly-plan\\?week=${week}$`));

    let commitmentRow = page.getByRole("row").filter({ hasText: taskName });
    await expect(commitmentRow).toBeVisible();
    await expect(commitmentRow.locator("select")).toHaveValue("COMMITTED");

    await page.getByRole("button", { name: "Open Agent" }).click();
    dialog = page.getByRole("dialog", { name: "Agent" });
    await dialog
      .getByLabel("Message Agent")
      .fill(`Mark ${taskName} not completed for ${week} because material delivery delayed`);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: taskName })
      .filter({ hasText: "Record incomplete commitment" });
    await expect(proposal).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByText("material delivery delayed")).toBeVisible();
    const varianceResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    const varianceResponse = await varianceResponsePromise;
    expect(varianceResponse.ok()).toBe(true);
    expect((await varianceResponse.json()).proposal.status).toBe("CONFIRMED");
    await proposal.getByRole("link", { name: "Open weekly plan" }).click();
    await expect(dialog).toBeHidden();

    commitmentRow = page.getByRole("row").filter({ hasText: taskName });
    await expect(commitmentRow.locator("select")).toHaveValue("NOT_COMPLETED");
    await expect(commitmentRow.getByPlaceholder("Reason for variance")).toHaveValue(
      "material delivery delayed"
    );
  } finally {
    await page.goto(projectPath);
    const taskRow = page.getByRole("row").filter({ hasText: taskName });
    if (await taskRow.count()) {
      await taskRow.getByRole("button", { name: `Delete ${taskName}` }).click();
      await expect(page.getByRole("link", { name: taskName })).toHaveCount(0);
    }
  }
});
