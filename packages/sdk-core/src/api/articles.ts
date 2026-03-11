import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import type { VisitorId, ArticleId, ArticleData } from "../types";
import { getVisitorState } from "../state/visitor";

const SEARCH_ARTICLES_FOR_VISITOR_REF =
  makeFunctionReference("articles:searchForVisitor") as FunctionReference<"query">;
const LIST_ARTICLES_FOR_VISITOR_REF =
  makeFunctionReference("articles:listForVisitor") as FunctionReference<"query">;
const GET_ARTICLE_REF = makeFunctionReference("articles:get") as FunctionReference<"query">;

interface ArticleDoc {
  _id: ArticleId;
  title: string;
  content: string;
  slug: string;
}

export async function searchArticles(params: {
  visitorId: VisitorId;
  sessionToken?: string;
  query: string;
}): Promise<ArticleData[]> {
  const client = getClient();
  const config = getConfig();
  const state = getVisitorState();
  const sessionToken = params.sessionToken ?? state.sessionToken ?? undefined;

  const results = await client.query(SEARCH_ARTICLES_FOR_VISITOR_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId: params.visitorId,
    sessionToken,
    query: params.query,
  });

  return results.map((article: ArticleDoc) => ({
    id: article._id,
    title: article.title,
    content: article.content,
    slug: article.slug,
  }));
}

export async function listArticles(
  visitorId: VisitorId,
  sessionToken?: string
): Promise<ArticleData[]> {
  const client = getClient();
  const config = getConfig();
  const state = getVisitorState();
  const token = sessionToken ?? state.sessionToken ?? undefined;

  const results = await client.query(LIST_ARTICLES_FOR_VISITOR_REF, {
    workspaceId: config.workspaceId as Id<"workspaces">,
    visitorId,
    sessionToken: token,
  });

  return results.map((article: ArticleDoc) => ({
    id: article._id,
    title: article.title,
    content: article.content,
    slug: article.slug,
  }));
}

export async function getArticle(articleId: ArticleId): Promise<ArticleData | null> {
  const client = getClient();

  const article = await client.query(GET_ARTICLE_REF, { id: articleId });

  if (!article) return null;

  const articleDoc = article as ArticleDoc;

  return {
    id: articleDoc._id,
    title: articleDoc.title,
    content: articleDoc.content,
    slug: articleDoc.slug,
  };
}
