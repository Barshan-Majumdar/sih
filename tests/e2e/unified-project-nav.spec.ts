import { expect, test, type Page } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

async function expectProjectRailContained(page: Page) {
  const header = page.locator("header").first();
  const projectNav = page.getByRole("navigation", { name: "Project workspace" });

  await expect(header).toBeVisible();
  await expect(projectNav).toBeVisible();

  const headerBox = await header.boundingBox();
  const projectNavBox = await projectNav.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(projectNavBox).not.toBeNull();
  expect(projectNavBox!.x).toBeGreaterThanOrEqual(0);
  expect(projectNavBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(projectNavBox!.x + projectNavBox!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(projectNavBox!.y + projectNavBox!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
}

test("keeps the desktop project rail visible and contained", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 946 });
  await signIn(page, PM_EMAIL);
  await openDemoProject(page);

  await expect(page.getByRole("link", { name: "Tasks", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expectProjectRailContained(page);

  await page.evaluate(() => window.scrollTo(0, 700));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expectProjectRailContained(page);

  await page.getByRole("link", { name: "Impacts", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/impacts$/);
  await expect(page.getByRole("link", { name: "Impacts", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("navigation", { name: "Project workspace" })).toHaveCount(1);
});

test("keeps the mobile project rail visible and contained", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, PM_EMAIL);
  await openDemoProject(page);

  const projectNav = page.getByRole("navigation", { name: "Project workspace" });
  const projectNavBox = await projectNav.boundingBox();
  expect(projectNavBox).not.toBeNull();
  expect(projectNavBox!.x).toBeGreaterThanOrEqual(0);
  expect(projectNavBox!.y).toBeGreaterThan(0);
  expect(projectNavBox!.x + projectNavBox!.width).toBeLessThanOrEqual(390);
  expect(projectNavBox!.y + projectNavBox!.height).toBeLessThanOrEqual(844);
  await expect(projectNav.locator("div").first()).toHaveCSS(
    "overflow-x",
    "auto"
  );
  await expect.poll(() =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  ).toBe(true);
});
