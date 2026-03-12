import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { InboxThreadPane } from "./InboxThreadPane";
import type {
  InboxConversation,
  InboxKnowledgeItem,
  InboxSnippet,
} from "./inboxRenderTypes";

function conversationId(value: string): Id<"conversations"> {
  return value as Id<"conversations">;
}

function messageId(value: string): Id<"messages"> {
  return value as Id<"messages">;
}

function visitorId(value: string): Id<"visitors"> {
  return value as Id<"visitors">;
}

function buildProps(overrides?: Partial<React.ComponentProps<typeof InboxThreadPane>>) {
  const selectedConversation: InboxConversation = {
    _id: conversationId("conv-1"),
    createdAt: Date.now(),
    status: "open",
    visitorId: visitorId("visitor-1"),
    visitor: {
      name: "Alex",
      email: "alex@example.com",
    },
  };

  const recentContent: InboxKnowledgeItem[] = [
    {
      id: "article-1",
      type: "article",
      title: "Refund policy",
      content: "Use the public help article for refund policy details.",
      slug: "refund-policy",
    },
  ];

  const allSnippets: InboxSnippet[] = [
    {
      _id: "snippet-1" as Id<"snippets">,
      name: "Billing follow-up",
      content: "Thanks for the follow-up. Here is the billing update.",
      shortcut: "billing-followup",
    },
  ];

  const knowledgeResults: InboxKnowledgeItem[] = [
    {
      id: "article-2",
      type: "article",
      title: "Subscription cancellation",
      content: "Public cancellation instructions.",
      slug: "subscription-cancellation",
      snippet: "Public cancellation instructions.",
    },
    {
      id: "article-3",
      type: "internalArticle",
      title: "Refund exception handling",
      content: "Internal notes for refund exceptions.",
      snippet: "Internal notes for refund exceptions.",
      tags: ["refunds"],
    },
  ];

  return {
    isCompactViewport: false,
    selectedConversationId: selectedConversation._id,
    selectedConversation,
    messages: [
      {
        _id: messageId("message-1"),
        senderType: "visitor" as const,
        content: "Can I cancel my subscription?",
        createdAt: Date.now(),
      },
    ],
    workflowError: null,
    highlightedMessageId: null,
    inputValue: "",
    pendingAttachments: [],
    isSending: false,
    isUploadingAttachments: false,
    isResolving: false,
    isConvertingTicket: false,
    showKnowledgePicker: true,
    knowledgeSearch: "",
    allSnippets,
    knowledgeResults,
    recentContent,
    activeCompactPanel: null,
    aiReviewPanelOpen: false,
    suggestionsPanelOpen: false,
    isSidecarEnabled: false,
    suggestionsCount: 0,
    isSuggestionsCountLoading: false,
    canSaveDraftAsSnippet: true,
    canUpdateSnippetFromDraft: true,
    lastInsertedSnippetName: "Billing follow-up",
    replyInputRef: createRef<HTMLInputElement>(),
    onBackToList: vi.fn(),
    onResolveConversation: vi.fn(),
    onConvertToTicket: vi.fn(),
    onOpenVisitorProfile: vi.fn(),
    onToggleAiReview: vi.fn(),
    onToggleSuggestions: vi.fn(),
    onInputChange: vi.fn(),
    onInputKeyDown: vi.fn(),
    onSendMessage: vi.fn(),
    onUploadAttachments: vi.fn(),
    onRemovePendingAttachment: vi.fn(),
    onToggleKnowledgePicker: vi.fn(),
    onKnowledgeSearchChange: vi.fn(),
    onCloseKnowledgePicker: vi.fn(),
    onInsertKnowledgeContent: vi.fn(),
    onSaveDraftAsSnippet: vi.fn(),
    onUpdateSnippetFromDraft: vi.fn(),
    getConversationIdentityLabel: () => "Alex",
    getHandoffReasonLabel: (reason) => reason ?? "fallback",
    ...overrides,
  } satisfies React.ComponentProps<typeof InboxThreadPane>;
}

describe("InboxThreadPane", () => {
  it("shows recent content and snippet actions in the consolidated picker", () => {
    const props = buildProps();
    render(<InboxThreadPane {...props} />);

    expect(screen.getByText("Recently Used")).toBeInTheDocument();
    expect(screen.getByText("Snippets")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save snippet" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Update "Billing follow-up"/ })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Insert Link" }));
    expect(props.onInsertKnowledgeContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "article-1", type: "article" }),
      "link"
    );
  });

  it("does not render inline snippet workflow controls in the composer", () => {
    const props = buildProps();
    render(<InboxThreadPane {...props} />);

    expect(screen.queryByRole("button", { name: "Save snippet" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Update "Billing follow-up"/ })
    ).not.toBeInTheDocument();

    expect(props.onSaveDraftAsSnippet).not.toHaveBeenCalled();
    expect(props.onUpdateSnippetFromDraft).not.toHaveBeenCalled();
  });

  it("inserts snippet content directly from the consolidated picker", () => {
    const props = buildProps();
    render(<InboxThreadPane {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));

    expect(props.onInsertKnowledgeContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "snippet-1", type: "snippet" })
    );
  });

  it("shows explicit link and content actions for search results", () => {
    const props = buildProps({
      knowledgeSearch: "refund",
    });
    render(<InboxThreadPane {...props} />);

    expect(screen.getByText("Search Results")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert Link" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Insert Content" })).toHaveLength(2);
    expect(screen.queryByText("Recently Used")).not.toBeInTheDocument();
    expect(screen.queryByText("Snippets")).not.toBeInTheDocument();
  });

  it("routes internal article search results through content insertion only", () => {
    const props = buildProps({
      knowledgeSearch: "refund",
    });
    render(<InboxThreadPane {...props} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Insert Content" })[1]!);

    expect(props.onInsertKnowledgeContent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "article-3", type: "internalArticle" })
    );
  });

  it("renders message attachments and queued reply attachments", () => {
    const props = buildProps({
      inputValue: "",
      pendingAttachments: [
        {
          attachmentId: "support-attachment-1" as Id<"supportAttachments">,
          fileName: "error-screenshot.png",
          mimeType: "image/png",
          size: 2048,
          status: "staged",
        },
      ],
      messages: [
        {
          _id: messageId("message-attachment"),
          senderType: "visitor" as const,
          content: "",
          createdAt: Date.now(),
          attachments: [
            {
              _id: "attached-file-1",
              fileName: "browser-log.txt",
              mimeType: "text/plain",
              size: 1536,
              url: "https://example.com/browser-log.txt",
            },
          ],
        },
      ],
    });

    render(<InboxThreadPane {...props} />);

    expect(screen.getByText("browser-log.txt")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-pending-attachments")).toBeInTheDocument();
    expect(screen.getByText("error-screenshot.png")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-send-button")).toBeEnabled();

    fireEvent.click(screen.getByLabelText("Remove error-screenshot.png"));
    expect(props.onRemovePendingAttachment).toHaveBeenCalledWith(
      "support-attachment-1" as Id<"supportAttachments">
    );
  });
});
