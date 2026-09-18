import { describe, it, expect } from "vitest";
import { stripAssistantMarkdown } from "@/lib/assistant-plain-text";

describe("stripAssistantMarkdown", () => {
  it("removes bold and heading markers", () => {
    const raw = "### Portfolio Summary\n\n**Riverside Apartments** has 2 open roadblocks.";
    expect(stripAssistantMarkdown(raw)).toBe("Portfolio Summary\n\nRiverside Apartments has 2 open roadblocks.");
  });

  it("removes bullet asterisks and hash prefixes", () => {
    const raw = "* First item\n* **Second** item\n# Note\n## Subheading";
    const out = stripAssistantMarkdown(raw);
    expect(out).not.toMatch(/[*#]/);
    expect(out).toContain("First item");
    expect(out).toContain("Second item");
  });

  it("keeps hash in identifiers like RFI numbers", () => {
    expect(stripAssistantMarkdown("Open RFI #12 is overdue.")).toBe("Open RFI #12 is overdue.");
  });

  it("strips orphaned stars models sometimes leave", () => {
    expect(stripAssistantMarkdown("This is *important* and **bold** text.")).toBe("This is important and bold text.");
  });
});
