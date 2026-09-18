import { describe, expect, it } from "vitest";
import { highlightPdfTextItem } from "@/lib/pdf-viewer";

describe("PDF citation highlighting", () => {
  it("marks distinctive citation terms without changing surrounding text", () => {
    const rendered = highlightPdfTextItem(
      "Use fire-rated sealant at every penetration.",
      "Install fire-rated sealant at every wall penetration."
    );
    expect(rendered).toContain("data-pdf-citation-highlight");
    expect(rendered).toContain(">fire-rated</mark>");
    expect(rendered).toContain(">penetration</mark>");
  });

  it("escapes PDF text before returning renderer markup", () => {
    expect(highlightPdfTextItem("<script>alert('x')</script>", "unrelated citation")).not.toContain(
      "<script>"
    );
  });
});
