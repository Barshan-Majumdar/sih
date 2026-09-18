import { expect, test } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("AI baseline create and compare proposals confirm without OpenRouter", async ({ page }) => {
  test.setTimeout(150_000);
  const baselineName = `E2E baseline ${Date.now()}`;

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
    await dialog.getByLabel("Message Agent").fill(`Create a baseline named ${baselineName}`);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    let proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: baselineName });
    await expect(proposal.getByText("Create baseline", { exact: false })).toBeVisible({ timeout: 30_000 });
    const createResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);
    expect((await createResponse.json()).proposal.status).toBe("CONFIRMED");

    await dialog
      .getByLabel("Message Agent")
      .fill(`Compare current schedule to the baseline named ${baselineName}`);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: baselineName })
      .filter({ hasText: "Compare baseline" });
    await expect(proposal).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByText("Avg variance")).toBeVisible();
    const compareResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    const compareResponse = await compareResponsePromise;
    expect(compareResponse.ok()).toBe(true);
    expect((await compareResponse.json()).proposal.status).toBe("CONFIRMED");
    await proposal.getByRole("link", { name: "Open baselines" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/baselines/);
    await expect(page.getByText(baselineName, { exact: true })).toBeVisible();
  } finally {
    const response = await page.request.get("/api/assistant/conversations", { timeout: 10_000 });
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          !existingConversationIds.has(conversation.id) &&
          (conversation.title.startsWith("Create a baseline") ||
            conversation.title.startsWith("Compare current schedule"))
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }
  }
});
