import {
  parseMarkdown as parseSharedMarkdown,
  type ParseMarkdownOptions,
} from "@opencom/web-shared";

const WEB_MARKDOWN_OPTIONS: ParseMarkdownOptions = {
  linkTarget: "_blank",
  linkRel: "noopener noreferrer",
};

export function parseMarkdown(markdownInput: string): string {
  return parseSharedMarkdown(markdownInput, WEB_MARKDOWN_OPTIONS);
}
