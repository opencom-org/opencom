(() => {
  const root = document.querySelector("main");

  function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function collapseInline(value) {
    return normalizeWhitespace(value).replace(/\s+([,.;:!?])/g, "$1");
  }

  function resolveHref(value) {
    if (!value) {
      return "";
    }
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }
    if (value.startsWith("mailto:") || value.startsWith("tel:")) {
      return value;
    }
    if (value.startsWith("#")) {
      return value;
    }
    if (value.startsWith("/")) {
      return value;
    }
    return value;
  }

  const ignoredTags = new Set([
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "video",
    "audio",
    "picture",
    "img",
    "source",
  ]);

  function serializeInline(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node;
    const tag = element.tagName.toLowerCase();

    if (ignoredTags.has(tag) || element.getAttribute("aria-hidden") === "true") {
      return "";
    }

    if (tag === "br") {
      return "\n";
    }

    if (tag === "a") {
      const href = resolveHref((element.getAttribute("href") || "").trim());
      const label = collapseInline(
        Array.from(element.childNodes)
          .map((child) => serializeInline(child))
          .join(" ")
      );
      const linkLabel = label || href;
      if (!href || !linkLabel) {
        return "";
      }
      return `[${linkLabel}](${href})`;
    }

    if (tag === "strong" || tag === "b") {
      const content = collapseInline(
        Array.from(element.childNodes)
          .map((child) => serializeInline(child))
          .join(" ")
      );
      return content ? `**${content}**` : "";
    }

    if (tag === "em" || tag === "i") {
      const content = collapseInline(
        Array.from(element.childNodes)
          .map((child) => serializeInline(child))
          .join(" ")
      );
      return content ? `*${content}*` : "";
    }

    if (
      tag === "code" &&
      (!element.parentElement || element.parentElement.tagName.toLowerCase() !== "pre")
    ) {
      const content = normalizeWhitespace(element.textContent || "");
      return content ? `\`${content}\`` : "";
    }

    return Array.from(element.childNodes)
      .map((child) => serializeInline(child))
      .join(" ");
  }

  function serializeList(listElement, ordered) {
    const items = Array.from(listElement.children).filter(
      (child) => child.tagName.toLowerCase() === "li"
    );

    const lines = [];
    items.forEach((item, index) => {
      const primaryText = collapseInline(
        Array.from(item.childNodes)
          .filter((child) => {
            if (child.nodeType !== Node.ELEMENT_NODE) {
              return true;
            }
            const tag = child.tagName.toLowerCase();
            return tag !== "ul" && tag !== "ol";
          })
          .map((child) => serializeInline(child))
          .join(" ")
      );

      const marker = ordered ? `${index + 1}.` : "-";
      if (primaryText) {
        lines.push(`${marker} ${primaryText}`);
      }

      const nestedLists = Array.from(item.children).filter((child) => {
        const tag = child.tagName.toLowerCase();
        return tag === "ul" || tag === "ol";
      });
      nestedLists.forEach((nestedList) => {
        const nestedMarkdown = serializeList(nestedList, nestedList.tagName.toLowerCase() === "ol");
        if (!nestedMarkdown) {
          return;
        }
        const indented = nestedMarkdown
          .split("\n")
          .map((line) => (line ? `  ${line}` : line))
          .join("\n");
        lines.push(indented);
      });
    });

    return lines.join("\n");
  }

  function serializeBlock(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = collapseInline(node.textContent || "");
      return text ? `${text}\n\n` : "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node;
    const tag = element.tagName.toLowerCase();

    if (ignoredTags.has(tag) || element.getAttribute("aria-hidden") === "true") {
      return "";
    }

    if (
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6"
    ) {
      const level = Number.parseInt(tag.slice(1), 10);
      const headingText = collapseInline(
        Array.from(element.childNodes)
          .map((child) => serializeInline(child))
          .join(" ")
      );
      return headingText ? `${"#".repeat(level)} ${headingText}\n\n` : "";
    }

    if (tag === "p") {
      const paragraph = collapseInline(
        Array.from(element.childNodes)
          .map((child) => serializeInline(child))
          .join(" ")
      );
      return paragraph ? `${paragraph}\n\n` : "";
    }

    if (tag === "ul" || tag === "ol") {
      const listMarkdown = serializeList(element, tag === "ol");
      return listMarkdown ? `${listMarkdown}\n\n` : "";
    }

    if (tag === "pre") {
      const code = (element.textContent || "")
        .replace(/\u00a0/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return code ? `\`\`\`\n${code}\n\`\`\`\n\n` : "";
    }

    if (tag === "a") {
      const link = collapseInline(serializeInline(element));
      return link ? `${link}\n\n` : "";
    }

    if (tag === "hr") {
      return "---\n\n";
    }

    return Array.from(element.childNodes)
      .map((child) => serializeBlock(child))
      .join("");
  }

  if (!root) {
    const fallbackTitle =
      document.title.replace(/\s*\|\s*Opencom.*$/i, "").trim() || "Landing Page";
    return {
      title: fallbackTitle,
      markdown: `# ${fallbackTitle}`,
    };
  }

  const clonedRoot = root.cloneNode(true);
  const removableSelectors = [
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "video",
    "audio",
    "picture",
    "img",
    "source",
    "[aria-hidden='true']",
    "[hidden]",
    "template",
  ];
  removableSelectors.forEach((selector) => {
    clonedRoot.querySelectorAll(selector).forEach((element) => element.remove());
  });

  let markdown = Array.from(clonedRoot.childNodes)
    .map((child) => serializeBlock(child))
    .join("");

  markdown = markdown
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const titleFromHeading = normalizeWhitespace(
    (clonedRoot.querySelector("h1") || {}).textContent || ""
  );
  const titleFromDocument = normalizeWhitespace(document.title.replace(/\s*\|\s*Opencom.*$/i, ""));
  const title = titleFromHeading || titleFromDocument || "Landing Page";

  return {
    title,
    markdown,
  };
})();
