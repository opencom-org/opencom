import { describe, expect, it } from "vitest";
import { parseMarkdown, stripMarkdownFrontmatter, toPlainTextExcerpt } from "./markdown";

describe("parseMarkdown", () => {
  it("renders standard markdown content", () => {
    const html = parseMarkdown("# Title\n\n- one\n- two\n\n`const x = 1`");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<code>const x = 1</code>");
  });

  it("strips dangerous protocols from links and media", () => {
    const html = parseMarkdown(
      '[bad](javascript:alert(1)) [worse](data:text/html;base64,abc) <img src="vbscript:evil" />'
    );
    expect(html).not.toMatch(/href="(?:javascript|data|vbscript):/i);
    expect(html).not.toMatch(/src="(?:javascript|data|vbscript):/i);
  });

  it("keeps safe links and enforces hardened link attributes", () => {
    const html = parseMarkdown("[Docs](https://example.com/docs)");
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("supports explicit surface-level link options", () => {
    const html = parseMarkdown("[Docs](https://example.com/docs)", {
      linkTarget: null,
      linkRel: null,
    });
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  it("detects article links and adds data-article-id attribute", () => {
    const html = parseMarkdown("[Read more](article:k57f8d9g2h3j4k5l)");
    expect(html).toContain('data-article-id="k57f8d9g2h3j4k5l"');
    expect(html).not.toContain("href=");
    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  it("renders article link text correctly", () => {
    const html = parseMarkdown("[Help Article](article:abc123)");
    expect(html).toContain(">Help Article<");
  });

  it("handles invalid article link format gracefully", () => {
    const html = parseMarkdown("[Invalid](article:)");
    expect(html).not.toContain("data-article-id");
    expect(html).not.toContain("href=");
  });
});

describe("frontmatter and excerpt helpers", () => {
  const contentWithFrontmatter = [
    "---",
    'title: "Hosted Quick Start"',
    "---",
    "",
    "# Hosted Quick Start",
    "",
    "Install the widget and configure your workspace.",
  ].join("\n");

  it("strips frontmatter before rendering", () => {
    const stripped = stripMarkdownFrontmatter(contentWithFrontmatter);
    expect(stripped).toContain("# Hosted Quick Start");
    expect(stripped).not.toContain("title:");
  });

  it("creates plain-text excerpts from markdown", () => {
    const excerpt = toPlainTextExcerpt(contentWithFrontmatter, 80);
    expect(excerpt).toContain("Hosted Quick Start");
    expect(excerpt).toContain("Install the widget");
    expect(excerpt).not.toContain("---");
    expect(excerpt).not.toContain("title:");
  });
});
