import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

async function seriousAccessibilityViolations(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const axe = (window as typeof window & {
      axe: {
        run: (
          root: Document,
          options: object
        ) => Promise<{ violations: AxeViolation[] }>;
      };
    }).axe;
    const result = await axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    );
  });
}

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")} ${node.failureSummary ?? ""}`)
          .join("\n")}`
    )
    .join("\n\n");
}

async function expectNoSeriousViolations(page: Page) {
  const violations = await seriousAccessibilityViolations(page);
  expect(violations, formatViolations(violations)).toEqual([]);
}

test("critical authenticated pages have no serious accessibility violations", async ({ page }) => {
  await signIn(page, PM_EMAIL);
  await expectNoSeriousViolations(page);

  await openDemoProject(page);
  const projectId = new URL(page.url()).pathname.split("/")[2];
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByLabel("Task name")).toBeVisible();
  await expect(page.getByLabel("Task start date")).toBeVisible();
  await expect(page.getByLabel("Task end date")).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.getByRole("button", { name: "Cancel" }).click();

  for (const route of ["weekly-plan", "files", "members", "dashboard"]) {
    await page.goto(`/projects/${projectId}/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
  }

  await page.getByRole("button", { name: "Open Agent" }).click();
  await expect(page.getByRole("dialog", { name: "Agent" })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("critical project routes stay contained on phone and tablet viewports", async ({ page }) => {
  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  const projectId = new URL(page.url()).pathname.split("/")[2];

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of ["", "weekly-plan", "files", "members", "dashboard"]) {
      await page.goto(`/projects/${projectId}${route ? `/${route}` : ""}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
          )
        )
        .toBe(true);
    }

    if (viewport.width === 390) {
      await page.getByRole("button", { name: "Open Agent" }).click();
      const agent = page.getByRole("dialog", { name: "Agent" });
      await expect(agent).toBeVisible();
      await expect
        .poll(() =>
          agent.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.left >= 0 && bounds.right <= window.innerWidth;
          })
        )
        .toBe(true);
      await page.keyboard.press("Escape");
      await expect(agent).toBeHidden();
    }
  }
});

test("keyboard users can enter and leave the Agent without losing focus", async ({ page }) => {
  await signIn(page, PM_EMAIL);
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const agentButton = page.getByRole("button", { name: "Open Agent" });
  await agentButton.focus();
  await page.keyboard.press("Enter");
  const agent = page.getByRole("dialog", { name: "Agent" });
  await expect(agent).toBeVisible();
  await expect(agent).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(agent.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(agent).not.toBeVisible();
  await expect(agentButton).toBeFocused();
});
