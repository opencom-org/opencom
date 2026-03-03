import { useEffect, useMemo, useState } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { Search, Book, ChevronLeft } from "../icons";
import { toPlainTextExcerpt } from "../utils/parseMarkdown";

interface Article {
  _id: Id<"articles">;
  title: string;
  content: string;
  collectionId?: Id<"collections">;
  order?: number;
}

interface Collection {
  _id: Id<"collections">;
  name: string;
  parentId?: Id<"collections">;
  description?: string;
}

interface HelpCenterProps {
  articleSearchQuery: string;
  onSearchChange: (query: string) => void;
  articleSearchResults: Article[] | undefined;
  publishedArticles: Article[] | undefined;
  collections: Collection[] | undefined;
  onSelectArticle: (id: Id<"articles">) => void;
}

interface ArticleGroup {
  key: string;
  label: string;
  collectionId?: Id<"collections">;
  articles: Article[];
}

const UNCATEGORIZED_GROUP_KEY = "__uncategorized__";

function normalizeCollectionLabel(
  collectionId: Id<"collections">,
  collectionMap: Map<Id<"collections">, Collection>
): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let cursor: Id<"collections"> | undefined = collectionId;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const collection = collectionMap.get(cursor);
    if (!collection) {
      break;
    }
    names.unshift(collection.name);
    cursor = collection.parentId;
  }

  return names.join(" / ");
}

function getArticleExcerpt(content: string): string {
  return toPlainTextExcerpt(content, 120) || "No preview available";
}

export function HelpCenter({
  articleSearchQuery,
  onSearchChange,
  articleSearchResults,
  publishedArticles,
  collections,
  onSelectArticle,
}: HelpCenterProps) {
  const [selectedCollectionKey, setSelectedCollectionKey] = useState<string | null>(null);

  const collectionMap = useMemo(() => {
    return new Map((collections ?? []).map((collection) => [collection._id, collection] as const));
  }, [collections]);

  const groupedArticles = useMemo(() => {
    if (!publishedArticles || publishedArticles.length === 0) {
      return [] as ArticleGroup[];
    }

    const groups = new Map<string, ArticleGroup>();
    for (const article of publishedArticles) {
      const collection = article.collectionId ? collectionMap.get(article.collectionId) : undefined;
      const groupKey = collection ? collection._id : UNCATEGORIZED_GROUP_KEY;
      const groupLabel = collection
        ? normalizeCollectionLabel(collection._id, collectionMap)
        : "Uncategorized";

      const existingGroup = groups.get(groupKey);
      if (existingGroup) {
        existingGroup.articles.push(article);
        continue;
      }

      groups.set(groupKey, {
        key: groupKey,
        label: groupLabel || "Uncategorized",
        collectionId: collection?._id,
        articles: [article],
      });
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        articles: group.articles.slice().sort((a, b) => {
          if (typeof a.order === "number" && typeof b.order === "number") {
            const orderDelta = a.order - b.order;
            if (orderDelta !== 0) {
              return orderDelta;
            }
          }
          return a.title.localeCompare(b.title);
        }),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [collectionMap, publishedArticles]);

  const selectedGroup = useMemo(
    () => groupedArticles.find((group) => group.key === selectedCollectionKey) ?? null,
    [groupedArticles, selectedCollectionKey]
  );

  useEffect(() => {
    if (articleSearchQuery.length >= 2) {
      setSelectedCollectionKey(null);
    }
  }, [articleSearchQuery]);

  useEffect(() => {
    if (!selectedCollectionKey) {
      return;
    }
    if (!groupedArticles.some((group) => group.key === selectedCollectionKey)) {
      setSelectedCollectionKey(null);
    }
  }, [groupedArticles, selectedCollectionKey]);

  const renderArticleButton = (article: Article) => (
    <button
      key={article._id}
      className="opencom-article-item"
      onClick={() => onSelectArticle(article._id)}
      type="button"
    >
      <Book />
      <div className="opencom-article-item-content">
        <span className="opencom-article-title">{article.title}</span>
        <span className="opencom-article-excerpt">{getArticleExcerpt(article.content)}</span>
      </div>
    </button>
  );

  const getCollectionDescription = (group: ArticleGroup): string | undefined => {
    if (group.key === UNCATEGORIZED_GROUP_KEY) {
      return "Articles without a collection";
    }
    if (!group.collectionId) {
      return undefined;
    }
    return collectionMap.get(group.collectionId)?.description;
  };

  return (
    <div className="opencom-article-search">
      <div className="opencom-search-input-container">
        <Search />
        <input
          type="text"
          className="opencom-search-input"
          placeholder="Search for help..."
          value={articleSearchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="opencom-article-results">
        {articleSearchQuery.length >= 2 ? (
          articleSearchResults === undefined ? (
            <div className="opencom-article-loading">Searching...</div>
          ) : articleSearchResults.length === 0 ? (
            <div className="opencom-article-empty">
              <Book />
              <p>No articles found</p>
              <span>Try different keywords</span>
            </div>
          ) : (
            articleSearchResults.map((article) => renderArticleButton(article))
          )
        ) : selectedGroup ? (
          <>
            <button
              type="button"
              className="opencom-collection-back"
              onClick={() => setSelectedCollectionKey(null)}
            >
              <ChevronLeft />
              <span>Collections</span>
            </button>
            <div className="opencom-article-section-title">{selectedGroup.label}</div>
            {selectedGroup.articles.map((article) => renderArticleButton(article))}
          </>
        ) : groupedArticles.length > 0 ? (
          <>
            <div className="opencom-collection-list-title">
              {groupedArticles.length} collection{groupedArticles.length === 1 ? "" : "s"}
            </div>
            {groupedArticles.map((group) => (
              <button
                key={group.key}
                type="button"
                className="opencom-collection-item"
                onClick={() => setSelectedCollectionKey(group.key)}
              >
                <div className="opencom-collection-item-content">
                  <div className="opencom-collection-item-title">{group.label}</div>
                  {getCollectionDescription(group) ? (
                    <div className="opencom-collection-item-description">
                      {getCollectionDescription(group)}
                    </div>
                  ) : null}
                  <div className="opencom-collection-item-meta">
                    {group.articles.length} article{group.articles.length === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="opencom-collection-item-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </>
        ) : (
          <div className="opencom-article-empty">
            <Book />
            <p>Help Center</p>
            <span>Search for articles or start a conversation</span>
          </div>
        )}
      </div>
    </div>
  );
}
