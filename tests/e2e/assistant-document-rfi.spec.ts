import { expect, test } from "@playwright/test";
import { openDemoProject, PM_EMAIL, signIn } from "./helpers";

function searchablePdf(text: string): Buffer {
  const escaped = text.replace(/([()\\])/g, "\\$1");
  const content = `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body);
}

test("AI raises an RFI linked to an uploaded project document", async ({ page }) => {
  test.setTimeout(150_000);
  const marker = Date.now();
  const fileName = `rfi-source-${marker}.pdf`;
  const question = `Which membrane detail applies ${marker}?`;
  let uploadedId: string | null = null;

  await signIn(page, PM_EMAIL);
  await openDemoProject(page);
  await expect(page).toHaveURL(/\/projects\/[^/?#]+$/);
  const pathSegments = new URL(page.url()).pathname.split("/").filter(Boolean);
  const projectId = pathSegments[pathSegments.indexOf("projects") + 1];
  await page.goto(`/projects/${projectId}/files`);
  await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeVisible({ timeout: 60_000 });

  try {
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${projectId}/files`) &&
        response.request().method() === "POST"
    );
    await page.getByLabel("Choose project files").setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: searchablePdf("Membrane terminations at parapets shall follow detail 7/A-501."),
    });
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    uploadedId = (await uploadResponse.json()).id;

    await page.getByRole("button", { name: `Raise RFI from ${fileName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Agent" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Start new conversation" }).click();
    const prompt = `Raise an RFI from ${fileName} page 1: ${question}`;
    await dialog.getByLabel("Message Agent").fill(prompt);
    await expect(dialog.getByRole("button", { name: "Send" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Send" }).dispatchEvent("click");

    const proposal = dialog
      .locator('section[aria-label="Action proposal"]')
      .filter({ hasText: question.replace(/\?$/, "") });
    await expect(proposal.getByText("Raise RFI", { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(proposal.getByText("Source document")).toBeVisible();
    const confirmPromise = page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().includes("/api/assistant/actions/")
    );
    await proposal.getByRole("button", { name: "Confirm change" }).click();
    const confirmResponse = await confirmPromise;
    expect(confirmResponse.ok()).toBe(true);
    expect((await confirmResponse.json()).proposal.status).toBe("CONFIRMED");
    await proposal.getByRole("link", { name: "Open RFI log" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/rfis/);
    const storedQuestion = question.replace(/\?$/, "");
    await expect(page.getByText(storedQuestion)).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(fileName.replace(".", "\\.")) })).toBeVisible();
  } finally {
    if (uploadedId) {
      await page.request.delete(`/api/projects/${projectId}/files/${uploadedId}`).catch(() => undefined);
    }
  }
});
