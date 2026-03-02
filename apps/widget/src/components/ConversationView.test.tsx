import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConversationView } from "./ConversationView";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));

vi.mock("@opencom/convex", () => ({
  api: {
    messages: {
      list: "messages.list",
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
  content: string;
  senderName?: string;
};

type AiResponseFixture = {
  _id: string;
  messageId: string;
  feedback?: "helpful" | "not_helpful";
  sources: Array<{ type: string; id: string; title: string }>;
  handedOff?: boolean;
};

describe("ConversationView personas", () => {
  let messagesResult: MessageFixture[];
  let aiResponsesResult: AiResponseFixture[];

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    messagesResult = [];
    aiResponsesResult = [];

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));

    const mockedUseAction = useAction as unknown as ReturnType<typeof vi.fn>;
    mockedUseAction.mockReturnValue(vi.fn().mockResolvedValue([]));

    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseQuery.mockImplementation((queryRef: unknown, args: unknown) => {
      if (args === "skip") {
        return undefined;
      }

      if (queryRef === "messages.list") {
        return messagesResult;
      }

      if (queryRef === "visitors.getBySession") {
        return null;
      }

      if (queryRef === "aiAgent.getPublicSettings") {
        return { enabled: true };
      }

      if (queryRef === "aiAgent.getConversationResponses") {
        return aiResponsesResult;
      }

      if (queryRef === "reporting.getCsatEligibility") {
        return { eligible: false, reason: "not_eligible" };
      }

      return undefined;
    });
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
        onSelectArticle={vi.fn()}
      />
    );
  };

  it("shows a named human agent badge alongside AI badges", () => {
    messagesResult = [
      {
        _id: "m_human",
        _creationTime: 1700000000000,
        senderType: "agent",
        senderName: "Alex",
        content: "Happy to help.",
      },
      {
        _id: "m_ai",
        _creationTime: 1700000005000,
        senderType: "bot",
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

  it("falls back to a default support name when sender name is unavailable", () => {
    messagesResult = [
      {
        _id: "m_support",
        _creationTime: 1700000010000,
        senderType: "agent",
        content: "We are looking into this.",
      },
    ];

    renderSubject();

    expect(screen.getByTestId("widget-human-agent-badge-m_support")).toHaveTextContent(
      "Support"
    );
  });

  it("renders markdown content for messages, including line breaks and lists", () => {
    messagesResult = [
      {
        _id: "m_markdown",
        _creationTime: 1700000015000,
        senderType: "bot",
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
});
