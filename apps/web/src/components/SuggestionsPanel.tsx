"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Card } from "@opencom/ui";
import {
  Sparkles,
  FileText,
  BookOpen,
  MessageSquareText,
  Plus,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import {
  type SuggestionRecord as Suggestion,
  useSuggestionsPanelConvex,
} from "@/components/hooks/useSuggestionsPanelConvex";

interface SuggestionsPanelProps {
  conversationId: Id<"conversations">;
  workspaceId: Id<"workspaces">;
  onInsert: (content: string) => void;
  onSuggestionsUpdated?: (count: number) => void;
}

export function SuggestionsPanel({
  conversationId,
  workspaceId,
  onInsert,
  onSuggestionsUpdated,
}: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { settings, getSuggestions, trackUsage, trackDismissal } =
    useSuggestionsPanelConvex(workspaceId);
  const resolvedEmbeddingModel =
    suggestions[0]?.embeddingModel ?? settings?.embeddingModel ?? "text-embedding-3-small";

  const fetchSuggestions = useCallback(async () => {
    if (!settings?.suggestionsEnabled) {
      setSuggestions([]);
      setError(null);
      onSuggestionsUpdated?.(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await getSuggestions({
        conversationId,
        limit: 5,
      });
      setSuggestions(results);
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
      setSuggestions([]);
      setError("Failed to load suggestions");
      onSuggestionsUpdated?.(0);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, getSuggestions, onSuggestionsUpdated, settings?.suggestionsEnabled]);

  useEffect(() => {
    void fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    setDismissedIds(new Set());
  }, [conversationId]);

  const handleInsert = async (suggestion: Suggestion) => {
    onInsert(suggestion.content);

    try {
      await trackUsage({
        workspaceId,
        conversationId,
        contentType: suggestion.type,
        contentId: suggestion.id,
        embeddingModel: suggestion.embeddingModel,
      });
    } catch (err) {
      console.error("Failed to track usage:", err);
    }
  };

  const handleDismiss = async (suggestion: Suggestion) => {
    setDismissedIds((prev) => new Set(prev).add(suggestion.id));

    try {
      await trackDismissal({
        workspaceId,
        conversationId,
        contentType: suggestion.type,
        contentId: suggestion.id,
        embeddingModel: suggestion.embeddingModel,
      });
    } catch (err) {
      console.error("Failed to track dismissal:", err);
    }
  };

  const handleViewFull = (suggestion: Suggestion) => {
    if (suggestion.type === "article") {
      window.open(`/articles/${suggestion.id}`, "_blank");
    } else if (suggestion.type === "internalArticle") {
      window.open(`/articles/${suggestion.id}`, "_blank");
    }
  };

  const getTypeIcon = (type: Suggestion["type"]) => {
    switch (type) {
      case "article":
        return <FileText className="h-4 w-4 text-primary" />;
      case "internalArticle":
        return <BookOpen className="h-4 w-4 text-purple-500" />;
      case "snippet":
        return <MessageSquareText className="h-4 w-4 text-green-500" />;
    }
  };

  const getTypeBadge = (type: Suggestion["type"]) => {
    const styles = {
      article: "bg-primary/10 text-primary",
      internalArticle: "bg-purple-100 text-purple-700",
      snippet: "bg-green-100 text-green-700",
    };
    const labels = {
      article: "Article",
      internalArticle: "Internal",
      snippet: "Snippet",
    };
    return <span className={`text-xs px-1.5 py-0.5 rounded ${styles[type]}`}>{labels[type]}</span>;
  };

  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

  useEffect(() => {
    onSuggestionsUpdated?.(visibleSuggestions.length);
  }, [onSuggestionsUpdated, visibleSuggestions.length]);

  if (!settings?.suggestionsEnabled) {
    return null;
  }

  return (
    <Card className="p-3" data-testid="inbox-suggestions-sidecar">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">AI Suggestions</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void fetchSuggestions();
          }}
          disabled={isLoading}
          className="h-7 px-2"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <p className="mb-3 text-xs text-muted-foreground" data-testid="inbox-suggestions-embedding-model">
        Using embedding model: {resolvedEmbeddingModel}
      </p>

      {isLoading && visibleSuggestions.length === 0 && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Finding relevant content...</span>
        </div>
      )}

      {error && <div className="text-sm text-red-500 py-2">{error}</div>}

      {!isLoading && !error && visibleSuggestions.length === 0 && (
        <div className="text-sm text-muted-foreground py-2 text-center">
          No suggestions available for this conversation
        </div>
      )}

      <div className="space-y-2">
        {visibleSuggestions.map((suggestion) => (
          <div
            key={`${suggestion.type}-${suggestion.id}`}
            className="border rounded-lg p-2 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {getTypeIcon(suggestion.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{suggestion.title}</span>
                    {getTypeBadge(suggestion.type)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {suggestion.snippet}
                  </p>
                  {suggestion.embeddingModel && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Embedding model {suggestion.embeddingModel}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(suggestion)}
                className="h-6 w-6 p-0 flex-shrink-0"
                aria-label={`Dismiss suggestion ${suggestion.title}`}
                title="Dismiss"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleInsert(suggestion)}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Insert
              </Button>
              {suggestion.type !== "snippet" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewFull(suggestion)}
                  className="h-7 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
