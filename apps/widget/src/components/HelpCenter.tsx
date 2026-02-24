import type { Id } from "@opencom/convex/dataModel";
import { Search, Book } from "../icons";

interface Article {
  _id: Id<"articles">;
  title: string;
  content: string;
}

interface HelpCenterProps {
  articleSearchQuery: string;
  onSearchChange: (query: string) => void;
  articleSearchResults: Article[] | undefined;
  publishedArticles: Article[] | undefined;
  onSelectArticle: (id: Id<"articles">) => void;
}

export function HelpCenter({
  articleSearchQuery,
  onSearchChange,
  articleSearchResults,
  publishedArticles,
  onSelectArticle,
}: HelpCenterProps) {
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
          // Show search results
          articleSearchResults === undefined ? (
            <div className="opencom-article-loading">Searching...</div>
          ) : articleSearchResults.length === 0 ? (
            <div className="opencom-article-empty">
              <Book />
              <p>No articles found</p>
              <span>Try different keywords</span>
            </div>
          ) : (
            articleSearchResults.map((article) => (
              <button
                key={article._id}
                className="opencom-article-item"
                onClick={() => onSelectArticle(article._id)}
              >
                <Book />
                <div className="opencom-article-item-content">
                  <span className="opencom-article-title">{article.title}</span>
                  <span className="opencom-article-excerpt">
                    {article.content.slice(0, 100)}...
                  </span>
                </div>
              </button>
            ))
          )
        ) : // Show browsable list of published articles
        publishedArticles && publishedArticles.length > 0 ? (
          publishedArticles.map((article) => (
            <button
              key={article._id}
              className="opencom-article-item"
              onClick={() => onSelectArticle(article._id)}
            >
              <Book />
              <div className="opencom-article-item-content">
                <span className="opencom-article-title">{article.title}</span>
                <span className="opencom-article-excerpt">{article.content.slice(0, 100)}...</span>
              </div>
            </button>
          ))
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
