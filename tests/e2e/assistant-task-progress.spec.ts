import { expect, test } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("AI task progress records actual dates and percent complete through confirmation cards", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const taskName = `E2E AI progress ${Date.now()}`;

  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  const projectPath = new URL(page.url()).pathname;
  const beforeResponse = await page.request.get("/api/assistant/conversations");
  const beforeData = beforeResponse.ok() ? await beforeResponse.json() : { conversations: [] };
  const existingConversationIds = new Set(
    beforeData.conversations.map((conversation: { id: string }) => conversation.id)
  );

  try {
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByPlaceholder("Task name").fill(taskName);
    const dateInputs = page.locator('form input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    await dateInputs.nth(0).fill("2026-09-14");
    await dateInputs.nth(1).fill("2026-09-18");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("link", { name: taskName })).toBeVisible();

    await page.getByRole("button", { name: "Open Agent" }).click();
    let dialog = page.getByRole("dialog", { name: "Agent" });
    await dialog.getByRole("button", { name: "Start new conversation" }).click();
    await dialog
      .getByLabel("Message Agent")
      .fill(`Record ${taskName} actual started on 2026-09-14 and progress 40%`);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    let proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: taskName })
      .filter({ hasText: "Update progress" });
    await expect(proposal.getByText("Actual start")).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByText("40%", { exact: true })).toBeVisible();
    let confirmResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    let confirmResponse = await confirmResponsePromise;
    expect(confirmResponse.ok()).toBe(true);
    expect((await confirmResponse.json()).proposal.status).toBe("CONFIRMED");
    await proposal.getByRole("link", { name: "Open task" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: taskName })).toBeVisible();
    await expect(page.getByText("40% complete", { exact: true })).toBeVisible();
    await expect(page.getByText("Actual start:").locator("..")).toContainText("Sep 14, 2026");

    await page.getByRole("button", { name: "Open Agent" }).click();
    dialog = page.getByRole("dialog", { name: "Agent" });
    await dialog
      .getByLabel("Message Agent")
      .fill(`Record ${taskName} actual finished on 2026-09-18`);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: taskName })
      .filter({ hasText: "Update progress" })
      .last();
    await expect(proposal.getByText("Actual finish")).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByText("100%", { exact: true })).toBeVisible();
    confirmResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    confirmResponse = await confirmResponsePromise;
    expect(confirmResponse.ok()).toBe(true);
    expect((await confirmResponse.json()).proposal.status).toBe("CONFIRMED");
    await proposal.getByRole("link", { name: "Open task" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("100% complete", { exact: true })).toBeVisible();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await expect(page.getByText("Actual finish:").locator("..")).toContainText("Sep 18, 2026");
  } finally {
    const response = await page.request.get("/api/assistant/conversations", { timeout: 10_000 });
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          !existingConversationIds.has(conversation.id) &&
          conversation.title.startsWith(`Record ${taskName}`)
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }

    await page.goto(projectPath);
    const taskRow = page.getByRole("row").filter({ hasText: taskName });
    if (await taskRow.count()) {
      await taskRow.getByRole("button", { name: `Delete ${taskName}` }).click();
      await expect(page.getByRole("link", { name: taskName })).toHaveCount(0);
    }
  }
});
