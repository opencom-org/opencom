import type { Id, Doc } from "@opencom/convex/dataModel";
import { sdkQueryRef, useSdkQuery } from "../internal/convex";
import { hasVisitorWorkspaceTransport } from "../internal/runtime";
import { useSdkTransportContext } from "../internal/opencomContext";

type Article = Doc<"articles">;

const LIST_ARTICLES_REF = sdkQueryRef("articles:listForVisitor");
const SEARCH_ARTICLES_REF = sdkQueryRef("articles:searchForVisitor");
const GET_ARTICLE_REF = sdkQueryRef("articles:get");

export function useArticles() {
  const transport = useSdkTransportContext();

  const articles = useSdkQuery<Article[]>(
    LIST_ARTICLES_REF,
    hasVisitorWorkspaceTransport(transport)
      ? {
          workspaceId: transport.workspaceId,
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
        }
      : "skip"
  );

  return {
    articles: (articles ?? []) as Article[],
    isLoading: articles === undefined,
  };
}

export function useArticleSearch(query: string) {
  const transport = useSdkTransportContext();

  const results = useSdkQuery<Article[]>(
    SEARCH_ARTICLES_REF,
    query.length >= 2 && hasVisitorWorkspaceTransport(transport)
      ? {
          workspaceId: transport.workspaceId,
          visitorId: transport.visitorId,
          sessionToken: transport.sessionToken,
          query,
        }
      : "skip"
  );

  return {
    results: (results ?? []) as Article[],
    isLoading: results === undefined && query.length >= 2,
  };
}

export function useArticle(articleId: Id<"articles"> | null) {
  const article = useSdkQuery<Article | null>(
    GET_ARTICLE_REF,
    articleId ? { id: articleId } : "skip"
  );

  return {
    article: article ?? null,
    isLoading: article === undefined && articleId !== null,
  };
}
