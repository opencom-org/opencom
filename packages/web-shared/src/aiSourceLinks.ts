export interface AISourceMetadata {
  type: string;
  id: string;
  title: string;
  articleId?: string;
}

export function resolveArticleSourceId(source: AISourceMetadata): string | null {
  const explicitArticleId = source.articleId?.trim();
  if (explicitArticleId) {
    return explicitArticleId;
  }

  if (source.type === "article") {
    const fallbackId = source.id.trim();
    return fallbackId.length > 0 ? fallbackId : null;
  }

  return null;
}
