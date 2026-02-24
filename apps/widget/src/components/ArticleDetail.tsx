import { useMemo } from "react";
import { ChevronLeft, X } from "../icons";
import { parseMarkdown } from "../utils/parseMarkdown";

interface ArticleDetailProps {
  article: { title: string; content: string } | undefined;
  onBack: () => void;
  onClose: () => void;
  onStartConversation: () => void;
}

export function ArticleDetail({
  article,
  onBack,
  onClose,
  onStartConversation,
}: ArticleDetailProps) {
  const renderedContent = useMemo(() => (article ? parseMarkdown(article.content) : ""), [article]);

  return (
    <div className="opencom-chat">
      <div className="opencom-header">
        <button onClick={onBack} className="opencom-back">
          <ChevronLeft />
        </button>
        <span>Article</span>
        <div className="opencom-header-actions">
          <button onClick={onClose} className="opencom-close">
            <X />
          </button>
        </div>
      </div>
      <div className="opencom-article-detail">
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
