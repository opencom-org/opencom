"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@opencom/convex";
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

type Suggestion = {
  id: string;
  type: "article" | "internalArticle" | "snippet";
  title: string;
  snippet: string;
  content: string;
  score: number;
};

interface SuggestionsPanelProps {
  conversationId: Id<"conversations">;
  workspaceId: Id<"workspaces">;
  onInsert: (content: string) => void;
}

export function SuggestionsPanel({ conversationId, workspaceId, onInsert }: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const settings = useQuery(api.aiAgent.getSettings, { workspaceId });
  const getSuggestions = useAction(api.suggestions.getForConversation);
  const trackUsage = useMutation(api.suggestions.trackUsage);
  const trackDismissal = useMutation(api.suggestions.trackDismissal);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!settings?.suggestionsEnabled) return;

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
        setError("Failed to load suggestions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [conversationId, settings?.suggestionsEnabled, getSuggestions]);

  const handleInsert = async (suggestion: Suggestion) => {
    onInsert(suggestion.content);

    try {
      await trackUsage({
        workspaceId,
        conversationId,
        contentType: suggestion.type,
        contentId: suggestion.id,
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
      });
    } catch (err) {
      console.error("Failed to track dismissal:", err);
    }
  };

  const handleViewFull = (suggestion: Suggestion) => {
    if (suggestion.type === "article") {
      window.open(`/help-center/articles/${suggestion.id}`, "_blank");
    } else if (suggestion.type === "internalArticle") {
      window.open(`/knowledge/internal/${suggestion.id}`, "_blank");
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

  if (!settings?.suggestionsEnabled) {
    return null;
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

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
          onClick={() => getSuggestions({ conversationId })}
          disabled={isLoading}
          className="h-7 px-2"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

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
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(suggestion)}
                className="h-6 w-6 p-0 flex-shrink-0"
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
