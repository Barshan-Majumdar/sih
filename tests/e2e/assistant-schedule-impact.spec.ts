import { expect, test } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("AI schedule impact requests create and approve through confirmation cards", async ({ page }) => {
  test.setTimeout(150_000);
  const description = `E2E rain delay ${Date.now()}`;
  const taskName = "Rough plumbing install";

  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  const beforeResponse = await page.request.get("/api/assistant/conversations");
  const beforeData = beforeResponse.ok() ? await beforeResponse.json() : { conversations: [] };
  const existingConversationIds = new Set(
    beforeData.conversations.map((conversation: { id: string }) => conversation.id)
  );

  try {
    await page.getByRole("button", { name: "Open Agent" }).click();
    const dialog = page.getByRole("dialog", { name: "Agent" });
    await dialog
      .getByRole("navigation", { name: "Project chats" })
      .getByRole("button", { name: /Harborview Residences — Building A/ })
      .click();
    await dialog.getByRole("button", { name: "Start new conversation" }).click();
    await dialog
      .getByLabel("Message Agent")
      .fill(`Create a schedule impact request for ${taskName}: ${description}`);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    let proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: description });
    await expect(proposal.getByText("Create impact request", { exact: false })).toBeVisible({
      timeout: 30_000,
    });
    const createResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);
    expect((await createResponse.json()).proposal.status).toBe("CONFIRMED");
    await expect(dialog.getByText(/OpenRouter could not complete/)).toHaveCount(0);

    const approvePrompt = `Approve the schedule impact request ${description} because weather log confirms`;
    await dialog.getByLabel("Message Agent").fill(approvePrompt);
    await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: "Approve impact request" })
      .filter({ hasText: description });
    await expect(proposal.getByRole("button", { name: "Confirm change" })).toBeVisible({ timeout: 30_000 });
    const reviewResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    const reviewResponse = await reviewResponsePromise;
    expect(reviewResponse.ok()).toBe(true);
    expect((await reviewResponse.json()).proposal.status).toBe("CONFIRMED");
    await proposal.getByRole("link", { name: "Open impacts" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/impacts/);
    await page.goto(page.url().replace(/(\?.*)?$/, "?status=APPROVED"));
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  } finally {
    const response = await page.request.get("/api/assistant/conversations", { timeout: 10_000 });
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          !existingConversationIds.has(conversation.id) &&
          (conversation.title.startsWith("Create a schedule impact") ||
            conversation.title.startsWith("Approve the schedule impact"))
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }
  }
});
