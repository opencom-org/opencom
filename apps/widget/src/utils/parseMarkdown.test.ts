import { describe, it, expect } from "vitest";
import { parseMarkdown } from "./parseMarkdown";

describe("parseMarkdown", () => {
  it("removes script tags", () => {
    const html = parseMarkdown('Hello<script>alert("xss")</script>');
    expect(html).not.toContain("<script");
    expect(html).toContain("Hello");
  });

  it("strips event handlers and keeps safe images", () => {
    const html = parseMarkdown('<img src="https://example.com/image.png" onerror="alert(1)" />');
    expect(html).toContain("<img");
    expect(html).toContain('src="https://example.com/image.png"');
    expect(html).not.toContain("onerror");
  });

  it("strips dangerous link protocols", () => {
    const html = parseMarkdown(
      '[bad](javascript:alert(1)) [worse](data:text/html;base64,abc) <a href="javascript:alert(1)">x</a> <img src="data:text/html;base64,abc" />'
    );
    expect(html).not.toMatch(/href="(?:javascript|data|vbscript):/i);
    expect(html).not.toMatch(/src="(?:javascript|data|vbscript):/i);
  });

  it("renders normal markdown with safe link attributes", () => {
    const html = parseMarkdown(
      "# Title\n\n**Bold** text\n\n- one\n- two\n\n`const x = 1`\n\n[Docs](https://example.com/docs)"
    );

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<code>const x = 1</code>");
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
