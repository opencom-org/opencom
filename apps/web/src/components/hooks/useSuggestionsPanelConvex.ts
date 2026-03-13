"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebAction,
  useWebMutation,
  useWebQuery,
  webActionRef,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

export type SuggestionRecord = {
  id: string;
  type: "article" | "internalArticle" | "snippet";
  title: string;
  snippet: string;
  content: string;
  score: number;
};

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type SuggestionsArgs = {
  conversationId: Id<"conversations">;
  limit: number;
};

type TrackSuggestionArgs = {
  workspaceId: Id<"workspaces">;
  conversationId: Id<"conversations">;
  contentType: SuggestionRecord["type"];
  contentId: string;
};

const AI_SETTINGS_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  { suggestionsEnabled?: boolean } | null
>("aiAgent:getSettings");
const GET_SUGGESTIONS_ACTION_REF = webActionRef<SuggestionsArgs, SuggestionRecord[]>(
  "suggestions:getForConversation"
);
const TRACK_USAGE_REF = webMutationRef<TrackSuggestionArgs, null>("suggestions:trackUsage");
const TRACK_DISMISSAL_REF = webMutationRef<TrackSuggestionArgs, null>(
  "suggestions:trackDismissal"
);

export function useSuggestionsPanelConvex(workspaceId: Id<"workspaces">) {
  return {
    getSuggestions: useWebAction(GET_SUGGESTIONS_ACTION_REF),
    settings: useWebQuery(AI_SETTINGS_QUERY_REF, { workspaceId }),
    trackDismissal: useWebMutation(TRACK_DISMISSAL_REF),
    trackUsage: useWebMutation(TRACK_USAGE_REF),
  };
}
