import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../parseMarkdown";

describe("parseMarkdown", () => {
  it("renders markdown headings and lists", () => {
    const html = parseMarkdown("# Heading\n\n- one\n- two");
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<ul>");
  });

  it("keeps safe images and removes dangerous protocols", () => {
    const html = parseMarkdown(
      '<img src="https://example.com/x.png" /> <img src="javascript:alert(1)" />'
    );
    expect(html).toContain('src="https://example.com/x.png"');
    expect(html).not.toContain("javascript:");
  });
});
