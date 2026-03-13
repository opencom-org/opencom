import { describe, expect, it } from "vitest";
import { resolveArticleSourceId, type AISourceMetadata } from "./aiSourceLinks";

describe("resolveArticleSourceId", () => {
  it("prefers explicit articleId metadata when present", () => {
    const source: AISourceMetadata = {
      type: "article",
      id: "legacy-id",
      title: "Getting Started",
      articleId: "article-explicit",
    };

    expect(resolveArticleSourceId(source)).toBe("article-explicit");
  });

  it("falls back to source id for legacy article records", () => {
    const source: AISourceMetadata = {
      type: "article",
      id: "article-legacy",
      title: "Legacy",
    };

    expect(resolveArticleSourceId(source)).toBe("article-legacy");
  });

  it("returns null for non-article sources", () => {
    const source: AISourceMetadata = {
      type: "snippet",
      id: "snippet-1",
      title: "Snippet",
    };

    expect(resolveArticleSourceId(source)).toBeNull();
  });
});
