import { describe, expect, it } from "vitest";

import {
  CONTENT_EMBEDDING_INDEX_DIMENSIONS,
  DEFAULT_CONTENT_EMBEDDING_MODEL,
  getContentEmbeddingModelCompatibilityMessage,
  isContentEmbeddingModelSupportedByCurrentIndex,
  LEGACY_CONTENT_EMBEDDING_MODEL,
  resolveContentEmbeddingModel,
} from "../convex/lib/embeddingModels";

describe("content embedding model compatibility", () => {
  it("keeps index-compatible models unchanged", () => {
    expect(resolveContentEmbeddingModel(DEFAULT_CONTENT_EMBEDDING_MODEL)).toBe(
      DEFAULT_CONTENT_EMBEDDING_MODEL
    );
    expect(resolveContentEmbeddingModel(LEGACY_CONTENT_EMBEDDING_MODEL)).toBe(
      LEGACY_CONTENT_EMBEDDING_MODEL
    );
    expect(isContentEmbeddingModelSupportedByCurrentIndex(DEFAULT_CONTENT_EMBEDDING_MODEL)).toBe(true);
    expect(isContentEmbeddingModelSupportedByCurrentIndex(LEGACY_CONTENT_EMBEDDING_MODEL)).toBe(true);
  });

  it("falls back from incompatible large embeddings to the default index-compatible model", () => {
    expect(resolveContentEmbeddingModel("text-embedding-3-large")).toBe(
      DEFAULT_CONTENT_EMBEDDING_MODEL
    );
    expect(isContentEmbeddingModelSupportedByCurrentIndex("text-embedding-3-large")).toBe(false);
    expect(getContentEmbeddingModelCompatibilityMessage("text-embedding-3-large")).toContain(
      String(CONTENT_EMBEDDING_INDEX_DIMENSIONS)
    );
  });

  it("normalizes supported embedding model ids to canonical constants", () => {
    expect(resolveContentEmbeddingModel("  Text-Embedding-3-Small  ")).toBe(
      DEFAULT_CONTENT_EMBEDDING_MODEL
    );
    expect(resolveContentEmbeddingModel("TEXT-EMBEDDING-ADA-002")).toBe(
      LEGACY_CONTENT_EMBEDDING_MODEL
    );
  });
});
