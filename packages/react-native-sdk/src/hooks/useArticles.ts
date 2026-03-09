import { useQuery } from "convex/react";
import { getVisitorState } from "@opencom/sdk-core";
import { useOpencomContext } from "../components/OpencomProvider";
import type { Id, Doc } from "@opencom/convex/dataModel";
import { makeFunctionReference, type FunctionReference } from "convex/server";

function getQueryRef(name: string): FunctionReference<"query"> {
  return makeFunctionReference(name) as FunctionReference<"query">;
}

type Article = Doc<"articles">;

export function useArticles() {
  const { workspaceId } = useOpencomContext();
  const state = getVisitorState();
  const visitorId = state.visitorId;
  const sessionToken = state.sessionToken;

  const articles = useQuery(
    getQueryRef("articles:listForVisitor"),
    visitorId && sessionToken && workspaceId
      ? { workspaceId: workspaceId as Id<"workspaces">, visitorId, sessionToken }
      : "skip"
  );

  return {
    articles: (articles ?? []) as Article[],
    isLoading: articles === undefined,
  };
}

export function useArticleSearch(query: string) {
  const { workspaceId } = useOpencomContext();
  const state = getVisitorState();
  const visitorId = state.visitorId;
  const sessionToken = state.sessionToken;

  const results = useQuery(
    getQueryRef("articles:searchForVisitor"),
    visitorId && sessionToken && query.length >= 2 && workspaceId
      ? { workspaceId: workspaceId as Id<"workspaces">, visitorId, sessionToken, query }
      : "skip"
  );

  return {
    results: (results ?? []) as Article[],
    isLoading: results === undefined && query.length >= 2,
  };
}

export function useArticle(articleId: Id<"articles"> | null) {
  const article = useQuery(getQueryRef("articles:get"), articleId ? { id: articleId } : "skip");

  return {
    article: article ?? null,
    isLoading: article === undefined && articleId !== null,
  };
}
