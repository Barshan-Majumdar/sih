import { describe, it, expect } from "vitest";
import { renderEmailHtml } from "@/lib/email";

describe("renderEmailHtml", () => {
  it("includes heading, body lines, and branding", () => {
    const html = renderEmailHtml("You've been assigned a task", ["Line one", "Line <strong>two</strong>"]);
    expect(html).toContain("Agira");
    expect(html).toContain("You've been assigned a task");
    expect(html).toContain("Line one");
    expect(html).toContain("Line <strong>two</strong>");
    expect(html).toContain("turn these notifications off in Settings");
  });

  it("renders a CTA button only when a URL is provided", () => {
    const withCta = renderEmailHtml("H", ["b"], "https://app.example.com/projects/x", "View task");
    expect(withCta).toContain('href="https://app.example.com/projects/x"');
    expect(withCta).toContain("View task");

    const withoutCta = renderEmailHtml("H", ["b"]);
    expect(withoutCta).not.toContain("<a href");
  });
});
