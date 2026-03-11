import {
  parseMarkdown as parseSharedMarkdown,
  stripMarkdownFrontmatter as stripSharedMarkdownFrontmatter,
  toPlainTextExcerpt as buildSharedPlainTextExcerpt,
  type ParseMarkdownOptions,
} from "@opencom/web-shared";

const WIDGET_MARKDOWN_OPTIONS: ParseMarkdownOptions = {
  linkTarget: "_blank",
  linkRel: "noopener noreferrer",
};

export const stripMarkdownFrontmatter = stripSharedMarkdownFrontmatter;
export function toPlainTextExcerpt(markdownInput: string, maxLength = 100): string {
  return buildSharedPlainTextExcerpt(markdownInput, maxLength);
}

export function parseMarkdown(markdownInput: string): string {
  return parseSharedMarkdown(markdownInput, WIDGET_MARKDOWN_OPTIONS);
}
