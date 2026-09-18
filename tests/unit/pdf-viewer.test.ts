import { describe, expect, it } from "vitest";
import { fileDownloadUrl, pdfPageUrl, pdfViewerDocument } from "@/lib/pdf-viewer";

describe("PDF viewer navigation", () => {
  it("builds audited download URLs without carrying page fragments", () => {
    expect(fileDownloadUrl("/api/files/project/report.pdf#page=7")).toBe(
      "/api/files/project/report.pdf?download=1"
    );
    expect(fileDownloadUrl("/api/files/project/report.pdf?token=one#page=2")).toBe(
      "/api/files/project/report.pdf?token=one&download=1"
    );
  });

  it("reads an exact page from a citation URL", () => {
    expect(pdfViewerDocument("/api/files/project/report.pdf#page=7", "Report")).toEqual({
      url: "/api/files/project/report.pdf",
      title: "Report",
      page: 7,
      pageCount: undefined,
      highlight: undefined,
    });
  });

  it("uses an explicit page and creates a browser PDF target", () => {
    const document = pdfViewerDocument("/api/files/project/report.pdf#page=2", "Report", {
      page: 4,
      pageCount: 12,
    });
    expect(pdfPageUrl(document)).toBe(
      "/api/files/project/report.pdf#page=4&zoom=page-width"
    );
  });

  it("falls back to the first page for invalid citation fragments", () => {
    expect(pdfViewerDocument("/api/files/project/report.pdf#page=nope", "Report").page).toBe(1);
  });

  it("carries a citation passage into the viewer request", () => {
    expect(
      pdfViewerDocument("/api/files/project/report.pdf#page=3", "Report", {
        highlight: "Install fire-rated sealant at every penetration.",
      }).highlight
    ).toBe("Install fire-rated sealant at every penetration.");
  });
});
