import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Streamdown } from "streamdown";

describe("Agent Markdown rendering", () => {
  it("renders emphasis and lists instead of exposing Markdown markers", () => {
    const markdown = "**Project health:**\n\n- **Completion:** 33%\n- **Open roadblocks:** 2";
    const html = renderToStaticMarkup(createElement(Streamdown, { mode: "static" }, markdown));

    expect(html).toContain('data-streamdown="strong"');
    expect(html).toContain("font-semibold");
    expect(html).toContain("<ul");
    expect(html).toContain("Project health:");
    expect(html).not.toContain("**");
  });

  it("sanitizes raw scripts while preserving the safe answer", () => {
    const markdown = '<script>alert("unsafe")</script>\n\n**Safe answer**';
    const html = renderToStaticMarkup(createElement(Streamdown, { mode: "static" }, markdown));

    expect(html).not.toContain("<script");
    expect(html).toContain("Safe answer");
  });
});
