export const CONTENT_EMBEDDING_INDEX_DIMENSIONS = 1536;
export const DEFAULT_CONTENT_EMBEDDING_MODEL = "text-embedding-3-small";
export const LARGE_CONTENT_EMBEDDING_MODEL = "text-embedding-3-large";
export const LEGACY_CONTENT_EMBEDDING_MODEL = "text-embedding-ada-002";

function normalizeModelName(model: string | undefined): string {
  return model?.trim().toLowerCase() ?? "";
}

export function getDefaultContentEmbeddingModel(): string {
  return DEFAULT_CONTENT_EMBEDDING_MODEL;
}

export function getContentEmbeddingIndexDimensions(): number {
  return CONTENT_EMBEDDING_INDEX_DIMENSIONS;
}

export function isContentEmbeddingModelSupportedByCurrentIndex(model: string | undefined): boolean {
  const normalized = normalizeModelName(model);
  return (
    normalized === "" ||
    normalized === DEFAULT_CONTENT_EMBEDDING_MODEL ||
    normalized === LEGACY_CONTENT_EMBEDDING_MODEL
  );
}

export function resolveContentEmbeddingModel(model: string | undefined): string {
  return isContentEmbeddingModelSupportedByCurrentIndex(model)
    ? model?.trim() || DEFAULT_CONTENT_EMBEDDING_MODEL
    : DEFAULT_CONTENT_EMBEDDING_MODEL;
}

export function getContentEmbeddingModelCompatibilityMessage(model: string | undefined): string | null {
  const normalized = normalizeModelName(model);
  if (normalized === LARGE_CONTENT_EMBEDDING_MODEL) {
    return `The current content embedding index expects ${CONTENT_EMBEDDING_INDEX_DIMENSIONS}-dimension vectors, so ${LARGE_CONTENT_EMBEDDING_MODEL} is not compatible yet. Falling back to ${DEFAULT_CONTENT_EMBEDDING_MODEL}.`;
  }

  return null;
}
