import { test, expect } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

function conversationTitle(prompt: string): string {
  return prompt.length <= 54 ? prompt : `${prompt.slice(0, 53).trimEnd()}...`;
}

test("project assistant attachments upload securely and persist across reloads", async ({ page }) => {
  test.setTimeout(120_000);
  const marker = Date.now();
  const fileName = `attachment-${marker}.pdf`;
  const prompt = `Save E2E ${marker} file with this project and confirm the attachment name.`;
  const title = conversationTitle(prompt);
  const pdfFixture = Buffer.concat([
    Buffer.from("%PDF-1.4\nBuilderBridge assistant attachment\n"),
    Buffer.alloc(10 * 1024 * 1024, 0x20),
    Buffer.from("\n%%EOF"),
  ]);
  let conversationId: string | null = null;

  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  await expect(page).toHaveURL(/\/projects\/[^/?#]+$/);
  const pathSegments = new URL(page.url()).pathname.split("/").filter(Boolean);
  const projectId = pathSegments[pathSegments.indexOf("projects") + 1];
  expect(projectId).toBeTruthy();
  const beforeResponse = await page.request.get("/api/assistant/conversations");
  const beforeData = await beforeResponse.json();
  const existingIds = new Set(
    beforeData.conversations.map((conversation: { id: string }) => conversation.id)
  );

  try {
    await page.getByRole("button", { name: "Open Agent" }).click();
    const dialog = page.getByRole("dialog", { name: "Agent" });
    await dialog
      .getByRole("navigation", { name: "Assistant project scopes" })
      .getByRole("button", { name: /Harborview Residences — Building A/ })
      .click();
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/assistant/conversations") &&
        response.request().method() === "POST"
    );
    await dialog.getByRole("button", { name: "Start new conversation" }).click();
    const createResponse = await createResponsePromise;
    const createdConversation = await createResponse.json();
    conversationId = createdConversation.id;
    await expect(dialog.getByLabel("Choose project attachments")).toBeVisible();
    await dialog.getByLabel("Choose project attachments").setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: pdfFixture,
    });
    await expect(dialog.getByText(fileName, { exact: true })).toBeVisible({ timeout: 30_000 });

    await dialog.getByLabel("Message Agent").fill(prompt);
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");
    const userMessage = dialog.locator('[data-message-role="user"]');
    const attachmentLink = userMessage.getByRole("link", { name: fileName });
    await expect(attachmentLink).toBeVisible({ timeout: 30_000 });
    const href = await attachmentLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/files\/documents\//);

    const ranged = await page.request.get(href!, { headers: { Range: "bytes=0-7" } });
    expect(ranged.status()).toBe(206);
    expect((await ranged.body()).toString()).toBe("%PDF-1.4");

    const assistantMessage = dialog.locator('[data-message-role="assistant"]');
    await expect(assistantMessage).toContainText(`${fileName}`);
    await expect(assistantMessage).toContainText("saved securely");
    await expect(dialog.getByText("BuilderBridge doesn't have a feature", { exact: false })).toHaveCount(0);

    const conversationsResponse = await page.request.get("/api/assistant/conversations");
    const conversationsData = await conversationsResponse.json();
    const created = conversationsData.conversations.find(
      (conversation: { id: string; title: string }) =>
        conversation.id === conversationId &&
        !existingIds.has(conversation.id) &&
        conversation.title === title
    );
    expect(created).toBeTruthy();

    await page.reload();
    await page.getByRole("button", { name: "Open Agent" }).click();
    const reloadedDialog = page.getByRole("dialog", { name: "Agent" });
    await reloadedDialog
      .getByRole("navigation", { name: "Assistant project scopes" })
      .getByRole("button", { name: /Harborview Residences — Building A/ })
      .click();
    await reloadedDialog.getByRole("button", { name: title }).click();
    await expect(
      reloadedDialog.locator('[data-message-role="user"]').getByRole("link", { name: fileName })
    ).toBeVisible();

    await page.goto(`/projects/${projectId}/files`);
    await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
    const fileRow = page.locator("tbody tr").filter({ hasText: fileName });
    await expect(fileRow).toBeVisible();
    await expect(fileRow).toContainText("AI upload");
    await expect(fileRow.getByRole("link", { name: fileName, exact: true })).toHaveAttribute(
      "href",
      /^\/api\/files\/documents\//
    );

    await page.getByPlaceholder("Search files, people, or sources").fill(fileName);
    await expect(fileRow).toBeVisible();
    await fileRow.getByRole("button", { name: "Open chat" }).click();
    const sourceDialog = page.getByRole("dialog", { name: "Agent" });
    await expect(sourceDialog).toBeVisible();
    await expect(sourceDialog.locator('[data-message-role="user"]')).toContainText(fileName);
    await sourceDialog.getByRole("button", { name: "Close Agent" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileFile = page.getByRole("listitem").filter({ hasText: fileName });
    await expect(mobileFile).toBeVisible();
    await expect(mobileFile.getByRole("link", { name: fileName, exact: true })).toHaveAttribute(
      "href",
      /^\/api\/files\/documents\//
    );
  } finally {
    if (conversationId) {
      await page.request.delete(`/api/assistant/conversations/${conversationId}`);
    }
  }
});
