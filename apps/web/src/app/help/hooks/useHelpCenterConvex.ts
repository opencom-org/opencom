"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type PublicWorkspaceContext = {
  _id?: Id<"workspaces">;
  helpCenterAccessPolicy?: string;
} | null;

type CollectionSummary = {
  _id: Id<"collections">;
  name: string;
  slug?: string;
  icon?: string;
  description?: string;
  publishedArticleCount: number;
};

type ArticleSearchResult = {
  _id: Id<"articles">;
  slug: string;
  title: string;
  content: string;
};

type PublicArticleRecord = {
  _id: Id<"articles">;
  slug: string;
  title: string;
};

type ArticleDetailRecord = {
  _id: Id<"articles">;
  slug: string;
  title: string;
  content: string;
  renderedContent?: string;
  status?: string;
  visibility?: string;
  collectionId?: Id<"collections">;
} | null;

type CollectionRecord = {
  _id: Id<"collections">;
  slug?: string;
  name: string;
} | null;

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type ArticleBySlugArgs = WorkspaceArgs & {
  slug: string;
};

type PublicCollectionsArgs = WorkspaceArgs & {
  publicOnly: true;
};

type ArticleSearchArgs = WorkspaceArgs & {
  query: string;
  publishedOnly: true;
  visibility: "public";
};

type ArticlesListArgs = WorkspaceArgs & {
  status: "published";
  visibility: "public";
};

type CollectionArgs = {
  id: Id<"collections">;
};

type ArticleFeedbackArgs = {
  articleId: Id<"articles">;
};

type SubmitArticleFeedbackArgs = ArticleFeedbackArgs & {
  helpful: boolean;
};

const PUBLIC_WORKSPACE_CONTEXT_QUERY_REF = webQueryRef<Record<string, never>, PublicWorkspaceContext>(
  "workspaces:getPublicWorkspaceContext"
);
const COLLECTIONS_LIST_QUERY_REF = webQueryRef<PublicCollectionsArgs, CollectionSummary[]>(
  "collections:listHierarchy"
);
const ARTICLES_SEARCH_QUERY_REF = webQueryRef<ArticleSearchArgs, ArticleSearchResult[]>(
  "articles:search"
);
const ARTICLES_LIST_QUERY_REF = webQueryRef<ArticlesListArgs, PublicArticleRecord[]>(
  "articles:list"
);
const ARTICLE_BY_SLUG_QUERY_REF = webQueryRef<ArticleBySlugArgs, ArticleDetailRecord>(
  "articles:get"
);
const COLLECTION_GET_QUERY_REF = webQueryRef<CollectionArgs, CollectionRecord>("collections:get");
const ARTICLE_FEEDBACK_STATS_QUERY_REF = webQueryRef<
  ArticleFeedbackArgs,
  { helpful: number; total: number } | null
>("articles:getFeedbackStats");
const SUBMIT_ARTICLE_FEEDBACK_REF = webMutationRef<SubmitArticleFeedbackArgs, null>(
  "articles:submitFeedback"
);

export function useHelpWorkspaceContextConvex() {
  return {
    workspaceContext: useWebQuery(PUBLIC_WORKSPACE_CONTEXT_QUERY_REF, {}),
  };
}

export function useHelpCenterPageConvex(workspaceId?: Id<"workspaces">, searchQuery?: string) {
  return {
    collections: useWebQuery(
      COLLECTIONS_LIST_QUERY_REF,
      workspaceId ? { workspaceId, publicOnly: true } : "skip"
    ),
    publishedArticles: useWebQuery(
      ARTICLES_LIST_QUERY_REF,
      workspaceId ? { workspaceId, status: "published", visibility: "public" } : "skip"
    ),
    searchResults: useWebQuery(
      ARTICLES_SEARCH_QUERY_REF,
      workspaceId && searchQuery && searchQuery.length >= 2
        ? { workspaceId, query: searchQuery, publishedOnly: true, visibility: "public" }
        : "skip"
    ),
  };
}

export function useHelpArticlePageConvex(slug: string, workspaceId?: Id<"workspaces">) {
  const article = useWebQuery(
    ARTICLE_BY_SLUG_QUERY_REF,
    workspaceId ? { slug, workspaceId } : "skip"
  );
  const publicArticleId =
    article && article.visibility !== "internal" ? (article._id as Id<"articles">) : null;

  return {
    article,
    collection: useWebQuery(
      COLLECTION_GET_QUERY_REF,
      article?.collectionId ? { id: article.collectionId } : "skip"
    ),
    feedbackStats: useWebQuery(
      ARTICLE_FEEDBACK_STATS_QUERY_REF,
      publicArticleId ? { articleId: publicArticleId } : "skip"
    ),
    submitFeedback: useWebMutation(SUBMIT_ARTICLE_FEEDBACK_REF),
  };
}
