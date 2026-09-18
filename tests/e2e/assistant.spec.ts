import { test, expect } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("RFI commands create proposal cards without OpenRouter", async ({ page }) => {
  test.setTimeout(90_000);
  const question = `E2E waterproofing detail ${Date.now()}`;
  const prompt = `Raise an RFI asking ${question}`;
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
    await dialog.getByLabel("Message Agent").fill(prompt);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    const proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: question });
    await expect(proposal).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByText("Confirmation required")).toBeVisible();
    await expect(proposal.getByText("Raise RFI", { exact: false })).toBeVisible();
    await expect(proposal.getByRole("button", { name: "Confirm change" })).toBeVisible();
    await expect(dialog.getByText(/OpenRouter could not complete/)).toHaveCount(0);
    const cancelPromise = page.waitForResponse(
      (response) => response.url().includes("/api/assistant/actions/") && response.request().method() === "PATCH"
    );
    await proposal.getByRole("button", { name: "Cancel" }).click();
    const cancelResponse = await cancelPromise;
    expect(cancelResponse.ok()).toBe(true);
    expect((await cancelResponse.json()).proposal.status).toBe("CANCELLED");
    await expect(proposal.getByText("Proposal cancelled")).toBeVisible();
    await proposal.getByRole("link", { name: "Open RFI log" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/rfis$/);
  } finally {
    const response = await page.request.get("/api/assistant/conversations", { timeout: 10_000 });
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          !existingConversationIds.has(conversation.id) && conversation.title.startsWith("Raise an RFI")
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }
  }
});

test("what-if schedule prompts create proposal cards without OpenRouter", async ({ page }) => {
  test.setTimeout(90_000);
  const targetDay = 10 + (Date.now() % 10);
  const targetLabel = `Aug ${targetDay}, 2026`;
  const prompt = `What happens if Rough plumbing install finishes on August ${targetDay}, 2026?`;
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
    await expect(dialog.locator("header").getByText("New conversation", { exact: true })).toBeVisible();
    await dialog.getByLabel("Message Agent").fill(prompt);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    const proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: "Confirmation required" })
      .filter({ hasText: "What-if: Rough plumbing install" })
      .filter({ hasText: targetLabel });
    await expect(proposal).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByText("What-if: Rough plumbing install")).toBeVisible();
    await expect(proposal.getByRole("button", { name: "Confirm change" })).toBeVisible();
    await expect(dialog.getByText(/OpenRouter could not complete/)).toHaveCount(0);
  } finally {
    const response = await page.request.get("/api/assistant/conversations", { timeout: 10_000 });
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          !existingConversationIds.has(conversation.id) &&
          conversation.title.startsWith("What happens if Rough plumbing")
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }
  }
});

test("project conversations stream and persist across reloads", async ({ page }) => {
  test.setTimeout(120_000);
  const prompt = `E2E assistant ${Date.now()}: Which projects need attention today?`;
  const title = `${prompt.slice(0, 53).trimEnd()}...`;
  await signIn(page, PM_EMAIL);
  await page.request.get("/api/assistant/chat");
  await page.reload();

  try {
    await page.getByRole("button", { name: "Open Agent" }).click();
    const dialog = page.getByRole("dialog", { name: "Agent" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Agent" })).toBeVisible();

    await dialog.getByRole("button", { name: "Start new conversation" }).click();
    await dialog.getByLabel("Message Agent").fill(prompt);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");
    await expect(dialog.locator('[data-message-role="user"]').getByText(prompt, { exact: true })).toBeVisible();
    await expect(dialog.locator('[data-message-role="assistant"]')).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => dialog.locator('[aria-label="Sources"]').count(), { timeout: 60_000 }).toBeGreaterThan(0);
    await expect(dialog.getByRole("button", { name: "Send" })).toBeVisible({ timeout: 60_000 });

    await page.reload();
    await page.getByRole("button", { name: "Open Agent" }).click();
    const reloadedDialog = page.getByRole("dialog", { name: "Agent" });
    await reloadedDialog.getByRole("button", { name: title }).click();
    await expect.poll(() => reloadedDialog.locator('[aria-label="Sources"]').count()).toBeGreaterThan(0);
  } finally {
    const response = await page.request.get("/api/assistant/conversations", { timeout: 10_000 });
    if (response.ok()) {
      const data = await response.json();
      const matches = data.conversations.filter(
        (conversation: { id: string; title: string }) =>
          conversation.title === title || conversation.title.startsWith("E2E assistant")
      );
      await Promise.all(
        matches.map((conversation: { id: string }) =>
          page.request.delete(`/api/assistant/conversations/${conversation.id}`)
        )
      );
    }
  }
});
