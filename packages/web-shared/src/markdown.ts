import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
];

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title", "class"];
const FRONTMATTER_BLOCK_REGEX = /^\uFEFF?---\s*\r?\n[\s\S]*?\r?\n---(?:\s*\r?\n)?/;

type ResolvedParseMarkdownOptions = {
  linkTarget: string | null;
  linkRel: string | null;
};

const DEFAULT_PARSE_MARKDOWN_OPTIONS: ResolvedParseMarkdownOptions = {
  linkTarget: "_blank",
  linkRel: "noopener noreferrer",
};

export interface ParseMarkdownOptions {
  linkTarget?: string | null;
  linkRel?: string | null;
}

function resolveParseMarkdownOptions(
  options: ParseMarkdownOptions | undefined
): ResolvedParseMarkdownOptions {
  return {
    linkTarget:
      options?.linkTarget === undefined
        ? DEFAULT_PARSE_MARKDOWN_OPTIONS.linkTarget
        : options.linkTarget,
    linkRel:
      options?.linkRel === undefined ? DEFAULT_PARSE_MARKDOWN_OPTIONS.linkRel : options.linkRel,
  };
}

function hasBlockedProtocol(rawUrl: string): boolean {
  const normalized = rawUrl.trim().toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("vbscript:")
  );
}

function hasDisallowedAbsoluteProtocol(rawUrl: string): boolean {
  const match = rawUrl.trim().match(/^([a-z0-9+.-]+):/i);
  if (!match) {
    return false;
  }
  const protocol = match[1].toLowerCase();
  return protocol !== "http" && protocol !== "https";
}

function enforceSafeLinksAndMedia(
  html: string,
  options: ResolvedParseMarkdownOptions
): string {
  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href || hasBlockedProtocol(href) || hasDisallowedAbsoluteProtocol(href)) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return;
    }

    if (options.linkTarget === null) {
      anchor.removeAttribute("target");
    } else {
      anchor.setAttribute("target", options.linkTarget);
    }

    if (options.linkRel === null) {
      anchor.removeAttribute("rel");
    } else {
      anchor.setAttribute("rel", options.linkRel);
    }
  });

  container.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src");
    if (!src || hasBlockedProtocol(src) || hasDisallowedAbsoluteProtocol(src)) {
      image.removeAttribute("src");
    }
  });

  return container.innerHTML;
}

export function stripMarkdownFrontmatter(markdownInput: string): string {
  if (!markdownInput) {
    return "";
  }
  return markdownInput.replace(FRONTMATTER_BLOCK_REGEX, "");
}

function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, " ");
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent ?? "";
}

export function toPlainTextExcerpt(markdownInput: string, maxLength = 100): string {
  const safeMaxLength = Math.max(1, maxLength);
  const contentWithoutFrontmatter = stripMarkdownFrontmatter(markdownInput);
  const rendered = markdown.render(contentWithoutFrontmatter);
  const normalizedText = htmlToPlainText(rendered).replace(/\s+/g, " ").trim();

  if (normalizedText.length <= safeMaxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, safeMaxLength).trimEnd()}...`;
}

export function parseMarkdown(
  markdownInput: string,
  options?: ParseMarkdownOptions
): string {
  const contentWithoutFrontmatter = stripMarkdownFrontmatter(markdownInput);
  const rendered = markdown.render(contentWithoutFrontmatter);
  const sanitized = DOMPurify.sanitize(rendered, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ["style"],
  });

  return enforceSafeLinksAndMedia(sanitized, resolveParseMarkdownOptions(options));
}
