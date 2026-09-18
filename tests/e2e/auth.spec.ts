import { test, expect } from "@playwright/test";
import { signIn, PM_EMAIL } from "./helpers";

test.describe("Authentication", () => {
  test("signs in with valid credentials and lands on projects", async ({ page }) => {
    await signIn(page, PM_EMAIL);
    await expect(page.getByRole("link", { name: /Harborview Residences — Building A/ }).first()).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(PM_EMAIL);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("landing page is public and shows marketing content", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /bridge between your schedule/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started", exact: true })).toBeVisible();
  });
});
