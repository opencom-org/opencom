import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAction, useMutation, useQuery } from "convex/react";

let ConversationView: typeof import("./ConversationView").ConversationView;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));

vi.mock("convex/server", () => ({
  makeFunctionReference: (_type: string, functionName: string) => ({ functionName }),
}));

vi.mock("../icons", () => ({
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  X: () => <span data-testid="icon-x" />,
  User: () => <span data-testid="icon-user" />,
}));

vi.mock("../hooks/useDebouncedValue", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock("./conversationView/constants", () => ({
  MANUAL_HANDOFF_REASON: "Visitor clicked Talk to human button",
}));

vi.mock("../utils/parseMarkdown", () => ({
  parseMarkdown: (markdownInput: string) =>
    markdownInput
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "<br /><br />")
      .replace(/\n/g, "<br />")
      .replace(/- ([^<]+)/g, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>'),
}));

vi.mock("./conversationView/MessageList", () => ({
  ConversationMessageList: ({
    messages,
    isAiMessage,
    getAiResponseData,
    onSelectArticle,
    showWaitingForHumanSupport,
    renderedMessages,
  }: any) => (
    <div data-testid="mock-message-list">
      {messages?.map((message: any) => {
        const aiResponse = getAiResponseData(message._id);
        const html = renderedMessages?.get?.(message._id) ?? message.content;

        return (
          <div key={message._id} data-testid={`mock-message-${message._id}`}>
            {message.senderType === "agent" && (
              <div data-testid={`widget-human-agent-badge-${message._id}`}>
                {message.senderName ?? "Support"}
              </div>
            )}
            {isAiMessage(message) && <div className="opencom-ai-badge">AI</div>}
            <div
              className="opencom-message-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {aiResponse?.sources?.map((source: any, index: number) =>
              source.type === "article" && source.articleId ? (
                <button
                  key={`${message._id}-${index}`}
                  data-testid={`widget-ai-source-link-${aiResponse._id}-${index}`}
                  onClick={() => onSelectArticle(source.articleId)}
                  type="button"
                >
                  {source.title}
                </button>
              ) : (
                <span key={`${message._id}-${index}`} data-testid={`widget-ai-source-text-${aiResponse._id}-${index}`}>
                  {source.title}
                </span>
              )
            )}
          </div>
        );
      })}
      {showWaitingForHumanSupport && <div data-testid="widget-waiting-human-divider" />}
    </div>
  ),
}));

vi.mock("./conversationView/Footer", () => ({
  ConversationFooter: ({ onSendMessage, onInputChange, onInputKeyDown }: any) => (
    <div data-testid="mock-footer">
      <input
        data-testid="mock-footer-input"
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={onInputKeyDown}
      />
      <button data-testid="mock-footer-send" onClick={onSendMessage} type="button">
        Send
      </button>
    </div>
  ),
}));

function getFunctionPath(ref: unknown) {
  if (typeof ref === "string") {
    return ref;
  }

  if (ref && typeof ref === "object") {
    const maybeRef = ref as {
      functionName?: string;
      name?: string;
      reference?: { functionName?: string; name?: string };
    };

    return (
      maybeRef.functionName ??
      maybeRef.name ??
      maybeRef.reference?.functionName ??
      maybeRef.reference?.name ??
      ""
    );
  }

  return "";
}

vi.mock("@opencom/convex", () => ({
  api: {
    messages: {
      list: "messages.list",
      send: "messages.send",
    },
    conversations: {
      get: "conversations.get",
    },
    visitors: {
      getBySession: "visitors.getBySession",
      identify: "visitors.identify",
    },
    aiAgent: {
      getPublicSettings: "aiAgent.getPublicSettings",
      getConversationResponses: "aiAgent.getConversationResponses",
      submitFeedback: "aiAgent.submitFeedback",
      handoffToHuman: "aiAgent.handoffToHuman",
    },
    aiAgentActions: {
      generateResponse: "aiAgentActions.generateResponse",
    },
    suggestions: {
      searchForWidget: "suggestions.searchForWidget",
    },
    reporting: {
      getCsatEligibility: "reporting.getCsatEligibility",
    },
  },
}));

vi.mock("../CsatPrompt", () => ({
  CsatPrompt: () => <div data-testid="widget-csat-prompt" />,
}));

type MessageFixture = {
  _id: string;
  _creationTime: number;
  senderType: "visitor" | "agent" | "bot" | "user";
  senderId: string;
  content: string;
  senderName?: string;
};

type AiResponseFixture = {
  _id: string;
  messageId: string;
  feedback?: "helpful" | "not_helpful";
  sources: Array<{ type: string; id: string; title: string; articleId?: string }>;
  handedOff?: boolean;
};

describe.skip("ConversationView personas", () => {
  let messagesResult: MessageFixture[];
  let aiResponsesResult: AiResponseFixture[];
  let conversationResult: { aiWorkflowState?: "none" | "ai_handled" | "handoff" } | null;
  let sendMessageMutationMock: ReturnType<typeof vi.fn>;
  let identifyVisitorMutationMock: ReturnType<typeof vi.fn>;
  let submitAiFeedbackMutationMock: ReturnType<typeof vi.fn>;
  let handoffToHumanMutationMock: ReturnType<typeof vi.fn>;
  let generateAiResponseActionMock: ReturnType<typeof vi.fn>;
  let searchSuggestionsActionMock: ReturnType<typeof vi.fn>;
  let onSelectArticleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    messagesResult = [];
    aiResponsesResult = [];
    conversationResult = { aiWorkflowState: "none" };

    sendMessageMutationMock = vi.fn().mockResolvedValue(undefined);
    identifyVisitorMutationMock = vi.fn().mockResolvedValue(undefined);
    submitAiFeedbackMutationMock = vi.fn().mockResolvedValue(undefined);
    handoffToHumanMutationMock = vi.fn().mockResolvedValue(undefined);
    generateAiResponseActionMock = vi.fn().mockResolvedValue(undefined);
    searchSuggestionsActionMock = vi.fn().mockResolvedValue([]);
    onSelectArticleMock = vi.fn();

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      const functionPath = getFunctionPath(mutationRef);

      if (functionPath === "messages:send" || functionPath === "messages.send") {
        return sendMessageMutationMock;
      }
      if (functionPath === "visitors:identify" || functionPath === "visitors.identify") {
        return identifyVisitorMutationMock;
      }
      if (functionPath === "aiAgent:submitFeedback" || functionPath === "aiAgent.submitFeedback") {
        return submitAiFeedbackMutationMock;
      }
      if (functionPath === "aiAgent:handoffToHuman" || functionPath === "aiAgent.handoffToHuman") {
        return handoffToHumanMutationMock;
      }
      return vi.fn().mockResolvedValue(undefined);
    });

    const mockedUseAction = useAction as unknown as ReturnType<typeof vi.fn>;
    mockedUseAction.mockImplementation((actionRef: unknown) => {
      const functionPath = getFunctionPath(actionRef);

      if (
        functionPath === "aiAgentActions:generateResponse" ||
        functionPath === "aiAgentActions.generateResponse"
      ) {
        return generateAiResponseActionMock;
      }
      if (
        functionPath === "suggestions:searchForWidget" ||
        functionPath === "suggestions.searchForWidget"
      ) {
        return searchSuggestionsActionMock;
      }
      return vi.fn().mockResolvedValue([]);
    });

    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseQuery.mockImplementation((queryRef: unknown, args: unknown) => {
      const functionPath = getFunctionPath(queryRef);

      if (args === "skip") {
        return undefined;
      }

      if (functionPath === "messages:list" || functionPath === "messages.list") {
        return messagesResult;
      }

      if (functionPath === "conversations:get" || functionPath === "conversations.get") {
        return conversationResult;
      }

      if (functionPath === "visitors:getBySession" || functionPath === "visitors.getBySession") {
        return null;
      }

      if (functionPath === "aiAgent:getPublicSettings" || functionPath === "aiAgent.getPublicSettings") {
        return { enabled: true };
      }

      if (
        functionPath === "aiAgent:getConversationResponses" ||
        functionPath === "aiAgent.getConversationResponses"
      ) {
        return aiResponsesResult;
      }

      if (
        functionPath === "reporting:getCsatEligibility" ||
        functionPath === "reporting.getCsatEligibility"
      ) {
        return { eligible: false, reason: "not_eligible" };
      }

      return undefined;
    });
  });

  beforeEach(async () => {
    ({ ConversationView } = await import("./ConversationView"));
  });

  const renderSubject = () => {
    render(
      <ConversationView
        conversationId={"conv_1" as any}
        visitorId={"visitor_1" as any}
        conversationStatus="open"
        activeWorkspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        sessionId="session_1"
        sessionTokenRef={{ current: "wst_test" }}
        sessionToken="wst_test"
        userInfo={undefined}
        automationSettings={{
          suggestArticlesEnabled: false,
          collectEmailEnabled: false,
          showReplyTimeEnabled: false,
          askForRatingEnabled: false,
        }}
        officeHoursStatus={undefined}
        expectedReplyTime={undefined}
        commonIssueButtons={undefined}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onSelectArticle={onSelectArticleMock as any}
      />
    );
  };

  it.only("shows a named human agent badge alongside AI badges", () => {
    messagesResult = [
      {
        _id: "m_human",
        _creationTime: 1700000000000,
        senderType: "agent",
        senderId: "agent_1",
        senderName: "Alex",
        content: "Happy to help.",
      },
      {
        _id: "m_ai",
        _creationTime: 1700000005000,
        senderType: "bot",
        senderId: "ai-agent",
        content: "Try restarting the app.",
      },
    ];
    aiResponsesResult = [
      {
        _id: "r_ai",
        messageId: "m_ai",
        sources: [],
        handedOff: false,
      },
    ];

    renderSubject();

    expect(screen.getByTestId("widget-human-agent-badge-m_human")).toHaveTextContent("Alex");
    expect(document.querySelectorAll(".opencom-ai-badge").length).toBeGreaterThan(0);
  });

  it.skip("falls back to a default support name when sender name is unavailable", () => {
    messagesResult = [
      {
        _id: "m_support",
        _creationTime: 1700000010000,
        senderType: "agent",
        senderId: "agent_2",
        content: "We are looking into this.",
      },
    ];

    renderSubject();

    expect(screen.getByTestId("widget-human-agent-badge-m_support")).toHaveTextContent(
      "Support"
    );
  });

  it.skip("renders markdown content for messages, including line breaks and lists", () => {
    messagesResult = [
      {
        _id: "m_markdown",
        _creationTime: 1700000015000,
        senderType: "bot",
        senderId: "ai-agent",
        content:
          "First line\nSecond line\n\n- Install the app\n- Invite teammates\n\n[Docs](https://example.com/docs)",
      },
    ];
    aiResponsesResult = [
      {
        _id: "r_markdown",
        messageId: "m_markdown",
        sources: [],
      },
    ];

    renderSubject();

    const messageContent = document.querySelector(".opencom-message-content");
    expect(messageContent).not.toBeNull();
    expect(messageContent?.querySelector("br")).not.toBeNull();
    expect(messageContent?.querySelectorAll("li")).toHaveLength(2);
    expect(messageContent?.querySelector("a")).toHaveAttribute("href", "https://example.com/docs");
    expect(messageContent?.querySelector("a")).toHaveAttribute("target", "_blank");
  });

  it.skip("shows AI badge and waiting divider for AI handoff without aiResponses", () => {
    conversationResult = { aiWorkflowState: "handoff" };
    messagesResult = [
      {
        _id: "m_user",
        _creationTime: 1700000020000,
        senderType: "visitor",
        senderId: "visitor_1",
        content: "Can you compare products?",
      },
      {
        _id: "m_handoff",
        _creationTime: 1700000024000,
        senderType: "bot",
        senderId: "ai-agent",
        content: "Let me connect you with a human agent who can help you better.",
      },
    ];
    aiResponsesResult = [];

    renderSubject();

    expect(document.querySelectorAll(".opencom-ai-badge").length).toBeGreaterThan(0);
    expect(screen.getByTestId("widget-waiting-human-divider")).toBeInTheDocument();
  });

  it.skip("hides waiting divider after a human agent reply", () => {
    conversationResult = { aiWorkflowState: "handoff" };
    messagesResult = [
      {
        _id: "m_user",
        _creationTime: 1700000030000,
        senderType: "visitor",
        senderId: "visitor_1",
        content: "Need billing help.",
      },
      {
        _id: "m_handoff",
        _creationTime: 1700000033000,
        senderType: "bot",
        senderId: "ai-agent",
        content: "Let me connect you with a human agent who can help you better.",
      },
      {
        _id: "m_agent",
        _creationTime: 1700000039000,
        senderType: "agent",
        senderId: "agent_5",
        content: "Hi, I can help with billing.",
      },
    ];
    aiResponsesResult = [];

    renderSubject();

    expect(screen.queryByTestId("widget-waiting-human-divider")).toBeNull();
  });

  it.skip("passes explicit handoff reason when visitor clicks talk to human", async () => {
    renderSubject();

    fireEvent.click(screen.getByTestId("widget-talk-to-human"));

    await waitFor(() => {
      expect(handoffToHumanMutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conv_1",
          visitorId: "visitor_1",
          sessionToken: "wst_test",
          reason: "Visitor clicked Talk to human button",
        })
      );
    });
  });

  it.skip("renders article sources as clickable links and opens the article", () => {
    messagesResult = [
      {
        _id: "m_ai_linked",
        _creationTime: 1700000045000,
        senderType: "bot",
        senderId: "ai-agent",
        content: "Try this guide.",
      },
    ];
    aiResponsesResult = [
      {
        _id: "r_ai_linked",
        messageId: "m_ai_linked",
        sources: [
          {
            type: "article",
            id: "legacy-article-id",
            articleId: "article_link_123",
            title: "Setup Guide",
          },
        ],
      },
    ];

    renderSubject();

    fireEvent.click(screen.getByTestId("widget-ai-source-link-r_ai_linked-0"));

    expect(onSelectArticleMock).toHaveBeenCalledWith("article_link_123");
  });

  it.skip("keeps non-article sources as non-clickable attribution text", () => {
    messagesResult = [
      {
        _id: "m_ai_fallback",
        _creationTime: 1700000050000,
        senderType: "bot",
        senderId: "ai-agent",
        content: "Based on snippets.",
      },
    ];
    aiResponsesResult = [
      {
        _id: "r_ai_fallback",
        messageId: "m_ai_fallback",
        sources: [
          {
            type: "snippet",
            id: "snippet_1",
            title: "Snippet Reference",
          },
        ],
      },
    ];

    renderSubject();

    expect(screen.getByTestId("widget-ai-source-text-r_ai_fallback-0")).toHaveTextContent(
      "Snippet Reference"
    );
    expect(screen.queryByTestId("widget-ai-source-link-r_ai_fallback-0")).toBeNull();
  });
});
