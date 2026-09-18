import { expect, test, type Locator, type Page } from "@playwright/test";
import { PM_EMAIL, signIn } from "./helpers";

async function expectWorkspaceInsideViewport(page: Page, dialog: Locator) {
  const viewport = page.viewportSize();
  const railToggle = dialog.getByRole("button", { name: "Agent", exact: true });
  const header = dialog.locator("header");
  const composer = dialog.getByLabel("Message Agent");

  await expect(railToggle).toBeVisible();
  await expect(header).toBeVisible();
  await expect(composer).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  for (const element of [railToggle, header, composer]) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  }
}

test("keeps the full Agent workspace contained at 100 percent zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 946 });
  await signIn(page, PM_EMAIL);
  await page.getByRole("button", { name: "Open Agent" }).click();

  const dialog = page.getByRole("dialog", { name: "Agent" });
  await expectWorkspaceInsideViewport(page, dialog);

  const projectChats = dialog.getByRole("region", {
    name: /Harborview Residences — Building A.*chats/i,
  });
  const conversationButtons = projectChats.locator('button:not([aria-label^="Delete "])');
  if ((await conversationButtons.count()) > 1) {
    const conversationButton = conversationButtons.nth(1);
    const conversationTitle = (await conversationButton.textContent())?.trim();
    await conversationButton.click();
    if (conversationTitle) {
      await expect(dialog.locator("header p")).toHaveText(conversationTitle);
    }
    await expect(dialog.getByLabel("Message Agent")).toBeVisible();
  }

  await page.waitForTimeout(500);
  await expectWorkspaceInsideViewport(page, dialog);
});
