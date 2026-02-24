import DOMPurify from "dompurify";

function hasBlockedProtocol(rawUrl: string): boolean {
  const normalized = rawUrl.trim().toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("vbscript:")
  );
}

function stripDangerousUrls(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("[href]").forEach((element) => {
    const href = element.getAttribute("href");
    if (href && hasBlockedProtocol(href)) {
      element.removeAttribute("href");
    }
  });

  container.querySelectorAll("[src]").forEach((element) => {
    const src = element.getAttribute("src");
    if (src && hasBlockedProtocol(src)) {
      element.removeAttribute("src");
    }
  });

  return container.innerHTML;
}

export function sanitizeHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "applet",
      "base",
      "link",
      "meta",
      "template",
    ],
    FORBID_ATTR: ["style"],
  });
  return stripDangerousUrls(sanitized);
}
