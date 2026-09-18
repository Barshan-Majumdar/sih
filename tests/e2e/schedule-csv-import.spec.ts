import { test, expect, type Page } from "@playwright/test";
import { signIn, openDemoProject, PM_EMAIL, TRADE_EMAIL } from "./helpers";

// The contractor's real path: download the template, fill it in, upload it, review
// the preview, import. Also covers the two things that make bulk import safe -
// a bad row blocks the whole file, and re-uploading updates instead of duplicating.
// The spec creates its own activities and deletes them, leaving the demo data untouched.
test.describe("Schedule CSV import", () => {
  const stamp = Date.now();
  const mobilize = `E2E CSV Mobilize ${stamp}`;
  const excavate = `E2E CSV Excavate ${stamp}`;

  const header = "Task Name,Assignee Email,Start Date,End Date,Status,Progress %,Predecessors";
  const validCsv = [
    header,
    `${mobilize},${PM_EMAIL},2026-08-10,2026-08-14,NOT_STARTED,0,`,
    `${excavate},${TRADE_EMAIL},2026-08-17,2026-08-21,IN_PROGRESS,25,${mobilize}`,
    "",
  ].join("\n");

  async function upload(page: Page, csv: string) {
    await page.locator('input[type="file"]').setInputFiles({
      name: "schedule.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });
  }

  async function deleteTask(page: Page, name: string) {
    // count() does not auto-wait, so wait for the row to render first - otherwise
    // cleanup races the table and silently skips, leaving rows behind.
    const link = page.getByRole("link", { name });
    await link.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    if ((await link.count()) === 0) return;
    await page
      .getByRole("row")
      .filter({ hasText: name })
      .getByRole("button", { name: `Delete ${name}` })
      .click();
    await expect(link).toHaveCount(0);
  }

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await signIn(page, PM_EMAIL);
    await openDemoProject(page);
    await deleteTask(page, excavate);
    await deleteTask(page, mobilize);
    await page.close();
  });

  test("download template, preview, block bad rows, import, re-import as updates", async ({ page }) => {
    await signIn(page, PM_EMAIL);
    await openDemoProject(page);

    await page.getByRole("button", { name: "Import CSV" }).click();

    // The template is what the contractor fills in, so it must actually download
    // and must carry the columns the parser expects.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download template" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("schedule-template.csv");
    const templateText = await download.createReadStream().then(async (stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks).toString("utf8");
    });
    expect(templateText.split(/\r?\n/)[0]).toBe(header);

    // A file with one bad row must block the entire import, not import part of it.
    await upload(page, [header, `${mobilize},,2026-08-14,2026-08-10,NOT_STARTED,0,`, ""].join("\n"));
    await expect(page.getByText("End Date must be on or after Start Date")).toBeVisible();
    await expect(page.getByRole("button", { name: "Import", exact: true })).toBeDisabled();

    // The good file previews as two new activities and imports.
    await upload(page, validCsv);
    await expect(page.getByText("2 rows · 2 new · 0 updates")).toBeVisible();
    await expect(page.getByRole("button", { name: "Import", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByRole("link", { name: mobilize })).toBeVisible();
    await expect(page.getByRole("link", { name: excavate })).toBeVisible();

    // Survives a reload, so it really was written rather than only rendered.
    await page.reload();
    await expect(page.getByRole("link", { name: excavate })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: excavate }).locator("select")).toHaveValue("IN_PROGRESS");

    // Re-uploading the same file must update in place, never duplicate.
    await page.getByRole("button", { name: "Import CSV" }).click();
    await upload(page, validCsv);
    await expect(page.getByText("2 rows · 0 new · 2 updates")).toBeVisible();
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByRole("link", { name: mobilize })).toHaveCount(1);
    await expect(page.getByRole("link", { name: excavate })).toHaveCount(1);
  });
});
