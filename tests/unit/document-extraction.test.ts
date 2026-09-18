import { describe, expect, it } from "vitest";
import { extractDocumentText } from "@/lib/document-extraction";

function searchablePdf(text: string): Uint8Array {
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
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Uint8Array(Buffer.from(body));
}

describe("document extraction", () => {
  it("extracts searchable text and a page count from a PDF", async () => {
    const result = await extractDocumentText(
      searchablePdf("Agira searchable project specification"),
      "application/pdf"
    );
    expect(result.status).toBe("READY");
    expect(result.pageCount).toBe(1);
    expect(result.text).toContain("Agira searchable project specification");
    expect(result.chunks).toEqual([
      expect.objectContaining({
        pageNumber: 1,
        chunkIndex: 0,
        text: expect.stringContaining("Agira searchable project specification"),
      }),
    ]);
  });

  it("identifies images that require OCR", async () => {
    const result = await extractDocumentText(new Uint8Array([1, 2, 3]), "image/png");
    expect(result.status).toBe("UNSUPPORTED");
    expect(result.error).toContain("needs OCR");
    expect(result.chunks).toEqual([]);
  });
});
