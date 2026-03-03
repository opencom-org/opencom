import { useMemo } from "react";
import { ChevronLeft, Maximize2, Minimize2, X } from "../icons";
import { parseMarkdown } from "../utils/parseMarkdown";

interface ArticleDetailProps {
  article: { title: string; content: string; renderedContent?: string } | undefined;
  isLargeScreen: boolean;
  isCollapsingLargeScreen: boolean;
  onToggleLargeScreen: () => void;
  onBack: () => void;
  onClose: () => void;
  onStartConversation: () => void;
}

export function ArticleDetail({
  article,
  isLargeScreen,
  isCollapsingLargeScreen,
  onToggleLargeScreen,
  onBack,
  onClose,
  onStartConversation,
}: ArticleDetailProps) {
  const renderedContent = useMemo(
    () => (article ? parseMarkdown(article.renderedContent ?? article.content) : ""),
    [article]
  );

  return (
    <div
      className={`opencom-chat opencom-chat-article-detail ${isLargeScreen ? "opencom-chat-article-large" : ""} ${isCollapsingLargeScreen ? "opencom-chat-article-collapsing" : ""}`}
    >
      <div className="opencom-header">
        <button onClick={onBack} className="opencom-back">
          <ChevronLeft />
        </button>
        <span>Article</span>
        <div className="opencom-header-actions">
          <button
            onClick={onToggleLargeScreen}
            className="opencom-article-size-toggle"
            title={isLargeScreen && !isCollapsingLargeScreen ? "Exit large view" : "Expand article"}
            aria-label={
              isLargeScreen && !isCollapsingLargeScreen ? "Exit large view" : "Expand article"
            }
            disabled={isCollapsingLargeScreen}
          >
            {isLargeScreen && !isCollapsingLargeScreen ? <Minimize2 /> : <Maximize2 />}
          </button>
          <button onClick={onClose} className="opencom-close">
            <X />
          </button>
        </div>
      </div>
      <div className={`opencom-article-detail ${isLargeScreen ? "opencom-article-detail-large" : ""}`}>
        {article ? (
          <>
            <h2 className="opencom-article-detail-title">{article.title}</h2>
            <div
              className="opencom-article-detail-content"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
            <div className="opencom-article-actions">
              <p>Still need help?</p>
              <button onClick={onStartConversation} className="opencom-start-conv">
                Start a conversation
              </button>
            </div>
          </>
        ) : (
          <div className="opencom-article-loading">Loading article...</div>
        )}
      </div>
    </div>
  );
}
