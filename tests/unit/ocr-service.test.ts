import { afterEach, describe, expect, it, vi } from "vitest";
import { createSearchablePdf, OcrServiceError } from "@/lib/ocr-service";

const config = {
  url: "http://ocr.internal",
  token: "test-secret",
  timeoutMs: 5_000,
};

afterEach(() => vi.unstubAllGlobals());

describe("OCR service client", () => {
  it("sends the original bytes to the private worker and accepts PDF output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array(Buffer.from("%PDF-1.4\nocr result")), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSearchablePdf(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      "image/png",
      "scan.png",
      config
    );

    expect(Buffer.from(result).toString("ascii")).toContain("%PDF-1.4");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://ocr.internal/v1/ocr",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
          "X-Request-ID": expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      })
    );
  });

  it("rejects a successful response that is not a PDF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not a pdf", { status: 200 })));
    await expect(
      createSearchablePdf(new Uint8Array([1]), "image/png", "scan.png", config)
    ).rejects.toBeInstanceOf(OcrServiceError);
  });
});
