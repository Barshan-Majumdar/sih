import { expect, test } from "@playwright/test";
import { PM_EMAIL, signIn } from "./helpers";

test("shows live and persisted message timing", async ({ page }) => {
  await page.route("**/api/assistant/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_250));
    await route.continue();
  });

  await signIn(page, PM_EMAIL);
  await page.getByRole("button", { name: "Open Agent" }).click();
  const dialog = page.getByRole("dialog", { name: "Agent" });
  await dialog.getByRole("button", { name: "Start new conversation" }).click();
  await dialog.getByLabel("Message Agent").fill("i want to submit an RFI");
  await dialog.getByRole("button", { name: "Send" }).click();

  const liveTiming = dialog.getByText(/Working for [1-9]\d*s/);
  await expect(liveTiming).toBeVisible();
  await expect(liveTiming.locator("xpath=../..").locator("img")).toHaveCount(0);
  await expect(dialog.getByText(/Worked for \d+s/)).toBeVisible({ timeout: 30_000 });

  const userMessage = dialog.locator('[data-message-role="user"]').last();
  const agentMessage = dialog.locator('[data-message-role="assistant"]').last();
  await expect(agentMessage.locator("img")).toHaveCount(0);
  await userMessage.hover();
  await expect(userMessage.locator("xpath=..//time")).toBeVisible();
  await agentMessage.hover();
  await expect(agentMessage.locator("xpath=..//time")).toBeVisible();

  await page.waitForTimeout(4_500);
  await page.reload();
  await page.getByRole("button", { name: "Open Agent" }).click();
  const reloadedDialog = page.getByRole("dialog", { name: "Agent" });
  await expect(reloadedDialog.getByText(/Worked for \d+s/).last()).toBeVisible();
});
