import { describe, expect, it } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import {
  ALL_COLLECTION_FILTER,
  GENERAL_COLLECTION_FILTER,
  type ArticleListItem,
} from "./articlesAdminTypes";
import {
  ALL_STATUS_FILTER,
  ALL_VISIBILITY_FILTER,
  filterArticles,
} from "./articlesAdminUtils";

function articleId(value: string): Id<"articles"> {
  return value as Id<"articles">;
}

function collectionId(value: string): Id<"collections"> {
  return value as Id<"collections">;
}

const articles: ArticleListItem[] = [
  {
    _id: articleId("article-public-published"),
    title: "Public Billing Guide",
    slug: "public-billing-guide",
    status: "published",
    visibility: "public",
    updatedAt: 300,
    collectionId: collectionId("collection-billing"),
    tags: ["billing"],
  },
  {
    _id: articleId("article-internal-published"),
    title: "Internal Refund Playbook",
    slug: "internal-refund-playbook",
    status: "published",
    visibility: "internal",
    updatedAt: 400,
    tags: ["refunds", "ops"],
  },
  {
    _id: articleId("article-public-archived"),
    title: "Legacy Public FAQ",
    slug: "legacy-public-faq",
    status: "archived",
    visibility: "public",
    updatedAt: 200,
    collectionId: collectionId("collection-billing"),
  },
];

describe("filterArticles", () => {
  it("filters by visibility and status while keeping newest results first", () => {
    const results = filterArticles(
      articles,
      "",
      ALL_COLLECTION_FILTER,
      "public",
      "published"
    );

    expect(results).toEqual([articles[0]]);
  });

  it("matches search across title, slug, and tags with collection filters", () => {
    const byTag = filterArticles(
      articles,
      "refund",
      GENERAL_COLLECTION_FILTER,
      ALL_VISIBILITY_FILTER,
      ALL_STATUS_FILTER
    );
    expect(byTag).toEqual([articles[1]]);

    const bySlug = filterArticles(
      articles,
      "legacy-public",
      collectionId("collection-billing"),
      ALL_VISIBILITY_FILTER,
      "archived"
    );
    expect(bySlug).toEqual([articles[2]]);
  });
});
