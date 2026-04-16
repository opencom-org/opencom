import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { InboxAiReviewPanel } from "./InboxAiReviewPanel";
import type { InboxAiResponse } from "./inboxRenderTypes";

function messageId(value: string): Id<"messages"> {
  return value as Id<"messages">;
}

function responseId(value: string): Id<"aiResponses"> {
  return value as Id<"aiResponses">;
}

describe("InboxAiReviewPanel", () => {
  it("renders persisted model and provider metadata for AI responses", () => {
    const response: InboxAiResponse = {
      _id: responseId("response_1"),
      createdAt: Date.now(),
      query: "How do I reset my password?",
      response: "Go to Settings > Security > Reset Password.",
      confidence: 0.82,
      model: "openai/gpt-5-nano",
      provider: "openai",
      handedOff: false,
      messageId: messageId("message_1"),
      sources: [],
      deliveredResponseContext: null,
      generatedResponseContext: null,
    };

    render(
      <InboxAiReviewPanel
        aiResponses={[response]}
        orderedAiResponses={[response]}
        selectedConversation={null}
        onOpenArticle={vi.fn()}
        onJumpToMessage={vi.fn()}
        getHandoffReasonLabel={(reason) => reason ?? "No reason"}
      />
    );

    expect(screen.getByText("Model openai/gpt-5-nano")).toBeInTheDocument();
    expect(screen.getByText("Provider openai")).toBeInTheDocument();
  });
});
