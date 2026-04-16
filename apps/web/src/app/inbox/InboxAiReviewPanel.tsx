"use client";

import { resolveArticleSourceId } from "@opencom/web-shared";
import { Button, Card } from "@opencom/ui";
import { ArrowUpRight, Bot } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import { type InboxAiResponse, type InboxConversation } from "./inboxRenderTypes";

interface InboxAiReviewPanelProps {
  aiResponses: InboxAiResponse[] | undefined;
  orderedAiResponses: InboxAiResponse[] | undefined;
  selectedConversation: InboxConversation | null;
  onOpenArticle: (articleId: string) => void;
  onJumpToMessage: (messageId: Id<"messages">) => void;
  getHandoffReasonLabel: (reason: string | null | undefined) => string;
}

export function InboxAiReviewPanel({
  aiResponses,
  orderedAiResponses,
  selectedConversation,
  onOpenArticle,
  onJumpToMessage,
  getHandoffReasonLabel,
}: InboxAiReviewPanelProps): React.JSX.Element {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4" />
          AI review
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Review AI responses, confidence, feedback, and handoff context.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {aiResponses === undefined ? (
          <p className="text-sm text-muted-foreground" data-testid="inbox-ai-review-loading">
            Loading AI responses...
          </p>
        ) : !orderedAiResponses || orderedAiResponses.length === 0 ? (
          selectedConversation?.aiWorkflow?.state === "handoff" ? (
            <div
              className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3"
              data-testid="inbox-ai-review-handoff-only"
            >
              <p className="text-sm font-medium text-amber-800">
                Conversation was handed off before an AI response record was stored.
              </p>
              <p className="text-xs text-amber-800">
                Handoff reason: {getHandoffReasonLabel(selectedConversation.aiWorkflow.handoffReason)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="inbox-ai-review-empty">
              No AI responses in this conversation yet.
            </p>
          )
        ) : (
          orderedAiResponses.map((response) => {
            const deliveredContext = response.deliveredResponseContext ?? {
              response: response.response,
              sources: response.sources,
              confidence: response.handedOff ? null : response.confidence,
            };
            const generatedContext = response.generatedResponseContext;
            const confidenceValue = generatedContext?.confidence ?? response.confidence;
            const confidenceLabel =
              response.handedOff && generatedContext ? "Candidate confidence" : "Confidence";
            const sourceLabel =
              response.handedOff && generatedContext ? "Candidate sources" : "Sources";
            const sourcesToShow =
              response.handedOff && generatedContext ? generatedContext.sources : response.sources;
            const isGenerationFailureHandoff =
              response.handoffReason === "AI returned an empty response" ||
              response.handoffReason === "AI generation failed" ||
              response.handoffReason === "AI returned an empty response and retry failed";

            return (
              <article
                key={response._id}
                className="rounded-lg border p-3 space-y-2"
                data-testid={`inbox-ai-review-entry-${response._id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      response.handedOff ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    <Bot className="h-3 w-3" />
                    {response.handedOff ? "AI handoff" : "AI handled"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(response.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-1">
                  {response.handedOff && (
                    <p className="text-xs text-muted-foreground">
                      Delivered to visitor (handoff message)
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{deliveredContext.response}</p>
                </div>

                {response.handedOff && response.query.trim().length > 0 && (
                  <div className="space-y-1 rounded bg-muted px-2 py-2">
                    <p className="text-xs text-muted-foreground">
                      Visitor message that triggered this handoff
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{response.query}</p>
                  </div>
                )}

                {response.handedOff && generatedContext && (
                  <div className="space-y-1 rounded bg-blue-50 px-2 py-2 text-blue-900">
                    <p className="text-xs font-medium text-blue-800">
                      Generated candidate response (not sent)
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{generatedContext.response}</p>
                  </div>
                )}

                {response.handedOff && !generatedContext && (
                  <p className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {isGenerationFailureHandoff
                      ? "No generated candidate response was produced for this handoff."
                      : "Generated candidate response unavailable for this legacy handoff record."}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-muted px-2 py-0.5">
                    {confidenceLabel} {Math.round(confidenceValue * 100)}%
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5" data-testid={`inbox-ai-review-model-${response._id}`}>
                    Model {response.model}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5" data-testid={`inbox-ai-review-provider-${response._id}`}>
                    Provider {response.provider}
                  </span>
                  {response.feedback && (
                    <span className="rounded bg-muted px-2 py-0.5">
                      Feedback {response.feedback === "helpful" ? "helpful" : "not helpful"}
                    </span>
                  )}
                </div>

                {sourcesToShow.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{sourceLabel}</p>
                    <ul className="flex flex-wrap gap-1">
                      {sourcesToShow.map((source, index) => {
                        const articleSourceId = resolveArticleSourceId(source);
                        return (
                          <li
                            key={`${response._id}-${source.id}-${index}`}
                            className="rounded border px-2 py-0.5 text-xs"
                          >
                            {articleSourceId ? (
                              <button
                                type="button"
                                className="text-blue-700 underline"
                                data-testid={`inbox-ai-review-source-link-${response._id}-${index}`}
                                onClick={() => onOpenArticle(articleSourceId)}
                              >
                                {source.title}
                              </button>
                            ) : (
                              <span
                                data-testid={`inbox-ai-review-source-text-${response._id}-${index}`}
                              >
                                {source.title}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {response.handedOff && (
                  <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    Handoff reason:{" "}
                    {getHandoffReasonLabel(
                      response.handoffReason ?? selectedConversation?.aiWorkflow?.handoffReason
                    )}
                  </p>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onJumpToMessage(response.messageId)}
                    data-testid={`inbox-ai-review-jump-${response._id}`}
                  >
                    View in thread
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </Card>
  );
}
