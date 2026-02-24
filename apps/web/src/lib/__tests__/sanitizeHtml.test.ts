import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../sanitizeHtml";

describe("sanitizeHtml", () => {
  it("removes script-style active content", () => {
    const result = sanitizeHtml(
      '<p>Hello</p><script>alert("xss")</script><iframe src="https://evil.example"></iframe>'
    );
    expect(result).toContain("<p>Hello</p>");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("<iframe");
  });

  it("removes inline event handlers", () => {
    const result = sanitizeHtml(
      '<p onclick="alert(1)">Click</p><img src="https://example.com/x.png" onerror="boom()" />'
    );
    expect(result).toContain("<p>Click</p>");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onerror");
  });

  it("removes dangerous URL protocols", () => {
    const result = sanitizeHtml(
      '<a href="javascript:alert(1)">bad</a><img src="data:text/html;base64,abc" />'
    );
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("data:text/html");
  });

  it("preserves safe formatting", () => {
    const html =
      '<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em> <a href="https://example.com">link</a></p><ul><li>One</li><li>Two</li></ul>';
    const result = sanitizeHtml(html);
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain("<strong>Bold</strong>");
    expect(result).toContain("<em>italic</em>");
    expect(result).toContain("<ul>");
    expect(result).toContain('href="https://example.com"');
  });
});
