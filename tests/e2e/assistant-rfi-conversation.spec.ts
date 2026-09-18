import { expect, test } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("conversational RFI submit asks for the question then creates a proposal card", async ({ page }) => {
  test.setTimeout(120_000);
  const question = `what happened to the parapet detail ${Date.now()}`;

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

    await dialog.getByLabel("Message Agent").fill("i want to submit an RFI");
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");
    await expect(dialog.getByText(/What question should I put on the new RFI/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(dialog.locator('section[aria-label="Action proposal"]')).toHaveCount(0);
    await expect(dialog.getByText(/I prepared the .* proposal/i)).toHaveCount(0);

    await dialog
      .getByLabel("Message Agent")
      .fill(`my question for new RFI is ${question}`);
    await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    const proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: question });
    await expect(proposal.getByText("Raise RFI", { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByRole("button", { name: "Confirm change" })).toBeVisible();
    await expect(dialog.getByText(/OpenRouter could not complete/)).toHaveCount(0);

    await dialog.getByLabel("Message Agent").fill("give me all the task options");
    await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");
    await expect(dialog.getByText(/Here are the project tasks you can link/i)).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    const response = await page.request.get("/api/assistant/conversations", { timeout: 10_000 });
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          !existingConversationIds.has(conversation.id) &&
          (conversation.title.startsWith("i want to submit") ||
            conversation.title.startsWith("my question for new RFI"))
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }
  }
});
