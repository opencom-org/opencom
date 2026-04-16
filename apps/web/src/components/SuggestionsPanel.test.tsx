import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { SuggestionsPanel } from "./SuggestionsPanel";

const mocks = vi.hoisted(() => ({
  getSuggestions: vi.fn(),
  trackUsage: vi.fn(),
  trackDismissal: vi.fn(),
}));

vi.mock("@/components/hooks/useSuggestionsPanelConvex", () => ({
  useSuggestionsPanelConvex: () => ({
    settings: {
      suggestionsEnabled: true,
      embeddingModel: "text-embedding-3-small",
    },
    getSuggestions: mocks.getSuggestions,
    trackUsage: mocks.trackUsage,
    trackDismissal: mocks.trackDismissal,
  }),
}));

function workspaceId(value: string): Id<"workspaces"> {
  return value as Id<"workspaces">;
}

function conversationId(value: string): Id<"conversations"> {
  return value as Id<"conversations">;
}

describe("SuggestionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSuggestions.mockResolvedValue([
      {
        id: "article_1",
        type: "article",
        title: "Reset Password",
        snippet: "Go to Settings > Security.",
        content: "Full reset password content",
        score: 0.91,
        embeddingModel: "text-embedding-3-small",
      },
    ]);
  });

  it("shows the resolved embedding model and passes it into usage tracking", async () => {
    render(
      <SuggestionsPanel
        conversationId={conversationId("conversation_1")}
        workspaceId={workspaceId("workspace_1")}
        onInsert={vi.fn()}
      />
    );

    expect(await screen.findByText("Using embedding model: text-embedding-3-small")).toBeInTheDocument();
    expect(screen.getByText("Embedding model text-embedding-3-small")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /insert/i }));

    await waitFor(() => {
      expect(mocks.trackUsage).toHaveBeenCalledWith({
        workspaceId: workspaceId("workspace_1"),
        conversationId: conversationId("conversation_1"),
        contentType: "article",
        contentId: "article_1",
        embeddingModel: "text-embedding-3-small",
      });
    });
  });

  it("passes the embedding model into dismissal tracking", async () => {
    render(
      <SuggestionsPanel
        conversationId={conversationId("conversation_2")}
        workspaceId={workspaceId("workspace_2")}
        onInsert={vi.fn()}
      />
    );

    await screen.findByText("Reset Password");
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    await waitFor(() => {
      expect(mocks.trackDismissal).toHaveBeenCalledWith({
        workspaceId: workspaceId("workspace_2"),
        conversationId: conversationId("conversation_2"),
        contentType: "article",
        contentId: "article_1",
        embeddingModel: "text-embedding-3-small",
      });
    });
  });
});
