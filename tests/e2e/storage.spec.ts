import { request as playwrightRequest, test, expect } from "@playwright/test";
import { deleteStoredFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

test("private R2 drawings stream only to project members", async ({ page }) => {
  test.setTimeout(90_000);
  const title = `Private storage E2E ${Date.now()}`;
  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  const projectUrl = new URL(page.url());
  const projectId = projectUrl.pathname.split("/").filter(Boolean).at(-1)!;

  let storageKey: string | null = null;
  try {
    await page.goto(`/projects/${projectId}/drawings`);
    await page.getByPlaceholder(/Title \(e\.g\. A-101 Floor Plan\)/).fill(title);
    await page.locator('input[name="file"]').setInputFiles({
      name: "private-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nAgira private test\n%%EOF"),
    });
    await page.getByRole("button", { name: "Upload" }).click();

    const drawingLink = page.getByRole("link", { name: title });
    await expect(drawingLink).toBeVisible({ timeout: 30_000 });
    const href = await drawingLink.getAttribute("href");
    expect(href).toMatch(/^\/api\/files\/drawings\//);
    storageKey = decodeURIComponent(href!.slice("/api/files/".length));

    const ranged = await page.request.get(href!, { headers: { Range: "bytes=0-7" } });
    expect(ranged.status()).toBe(206);
    expect(ranged.headers()["content-range"]).toMatch(/^bytes 0-7\//);
    expect((await ranged.body()).toString()).toBe("%PDF-1.4");

    const anonymous = await playwrightRequest.newContext({
      baseURL: "http://localhost:3000",
      maxRedirects: 0,
    });
    try {
      const denied = await anonymous.get(href!);
      expect([307, 404]).toContain(denied.status());
    } finally {
      await anonymous.dispose();
    }
  } finally {
    const drawing = await prisma.drawing.findFirst({ where: { projectId, title } });
    if (drawing) await prisma.drawing.delete({ where: { id: drawing.id } });
    if (storageKey) await deleteStoredFile(storageKey);
  }
});
