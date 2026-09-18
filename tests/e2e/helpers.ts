import { type Page, expect } from "@playwright/test";

export const DEMO_PASSWORD = "HarborDemo1!";
export const PM_EMAIL = "alex@harborview.demo";
export const TRADE_EMAIL = "diego@harborview.demo";
export const DEMO_PROJECT_NAME = /Harborview Residences — Building A/;

/** Signs in via the real form and waits until the projects list is visible. */
export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/projects/, { timeout: 20_000 });
}

/** Opens the seeded demo project's Tasks tab. */
export async function openDemoProject(page: Page) {
  if (new URL(page.url()).pathname !== "/projects") {
    await page.goto("/projects");
  }
  await expect(page.getByRole("link", { name: DEMO_PROJECT_NAME }).first()).toBeVisible();
  await page.getByRole("link", { name: DEMO_PROJECT_NAME }).first().click();
  await expect(page.getByRole("heading", { name: DEMO_PROJECT_NAME })).toBeVisible();
}
