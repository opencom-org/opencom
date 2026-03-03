import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { Widget } from "../Widget";

type MockHomeConfig = {
  enabled: boolean;
  defaultSpace?: "home" | "messages" | "help";
  tabs?: Array<{
    id: "home" | "messages" | "help" | "tours" | "tasks" | "tickets";
    enabled: boolean;
    visibleTo: "all" | "visitors" | "users";
  }>;
};

let mockedHomeConfig: MockHomeConfig = { enabled: true };

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@opencom/convex", () => ({
  api: {
    workspaces: {
      get: "workspaces.get",
      validateOrigin: "workspaces.validateOrigin",
    },
    tickets: {
      listByVisitor: "tickets.listByVisitor",
      get: "tickets.get",
      addComment: "tickets.addComment",
      create: "tickets.create",
    },
    ticketForms: {
      getDefaultForVisitor: "ticketForms.getDefaultForVisitor",
    },
    conversations: {
      listByVisitor: "conversations.listByVisitor",
      getTotalUnreadForVisitor: "conversations.getTotalUnreadForVisitor",
      createForVisitor: "conversations.createForVisitor",
      markAsRead: "conversations.markAsRead",
    },
    articles: {
      searchForVisitor: "articles.searchForVisitor",
      listForVisitor: "articles.listForVisitor",
    },
    collections: {
      listHierarchy: "collections.listHierarchy",
    },
    automationSettings: {
      getOrCreate: "automationSettings.getOrCreate",
    },
    commonIssueButtons: {
      list: "commonIssueButtons.list",
    },
    officeHours: {
      isCurrentlyOpen: "officeHours.isCurrentlyOpen",
      getExpectedReplyTime: "officeHours.getExpectedReplyTime",
    },
    tourProgress: {
      getAvailableTours: "tourProgress.getAvailableTours",
    },
    tours: {
      listAll: "tours.listAll",
    },
    checklists: {
      getEligible: "checklists.getEligible",
    },
    surveys: {
      getActiveSurveys: "surveys.getActiveSurveys",
    },
    tooltips: {
      getAvailableTooltips: "tooltips.getAvailableTooltips",
    },
  },
}));

vi.mock("../main", () => ({
  setStartTourCallback: vi.fn(),
  setGetAvailableToursCallback: vi.fn(),
}));

vi.mock("../components/Home", () => ({
  Home: () => <div data-testid="home-component" />,
  useHomeConfig: vi.fn(() => mockedHomeConfig),
}));

vi.mock("../components/ConversationList", () => ({
  ConversationList: ({
    conversations,
    onSelectConversation,
  }: {
    conversations?: Array<{ _id: string }>;
    onSelectConversation: (id: string) => void;
  }) => (
    <div data-testid="conversation-list">
      <button
        type="button"
        data-testid="mock-open-first-conversation"
        onClick={() => {
          const firstConversation = conversations?.[0];
          if (firstConversation) {
            onSelectConversation(firstConversation._id);
          }
        }}
      >
        Open first conversation
      </button>
    </div>
  ),
}));

vi.mock("../components/ConversationView", () => ({
  ConversationView: ({
    conversationId,
    onBack,
  }: {
    conversationId: string;
    onBack: () => void;
  }) => (
    <div data-testid="conversation-view">
      <span>{conversationId}</span>
      <button type="button" data-testid="mock-back-to-list" onClick={onBack}>
        Back to list
      </button>
    </div>
  ),
}));

vi.mock("../components/HelpCenter", () => ({
  HelpCenter: ({
    publishedArticles,
    onSelectArticle,
  }: {
    publishedArticles?: Array<{ _id: string }>;
    onSelectArticle: (id: string) => void;
  }) => (
    <div data-testid="help-center">
      <button
        type="button"
        data-testid="mock-open-first-article"
        onClick={() => {
          const firstArticle = publishedArticles?.[0];
          if (firstArticle) {
            onSelectArticle(firstArticle._id);
          }
        }}
      >
        Open first article
      </button>
    </div>
  ),
}));

vi.mock("../components/ArticleDetail", () => ({
  ArticleDetail: () => <div data-testid="article-detail" />,
}));

vi.mock("../components/TourPicker", () => ({
  TourPicker: () => <div data-testid="tour-picker" />,
}));

vi.mock("../components/TasksList", () => ({
  TasksList: () => <div data-testid="tasks-list" />,
}));

vi.mock("../components/TicketsList", () => ({
  TicketsList: () => <div data-testid="tickets-list" />,
}));

vi.mock("../components/TicketDetail", () => ({
  TicketDetail: () => <div data-testid="ticket-detail" />,
}));

vi.mock("../components/TicketCreate", () => ({
  TicketCreate: () => <div data-testid="ticket-create" />,
}));

vi.mock("../TourOverlay", () => ({
  TourOverlay: () => null,
}));

vi.mock("../OutboundOverlay", () => ({
  OutboundOverlay: () => null,
}));

vi.mock("../TooltipOverlay", () => ({
  TooltipOverlay: () => null,
}));

vi.mock("../SurveyOverlay", () => ({
  SurveyOverlay: () => null,
}));

vi.mock("../hooks/useWidgetSession", () => ({
  useWidgetSession: vi.fn(() => ({
    sessionId: "session_1",
    visitorId: "visitor_1",
    setVisitorId: vi.fn(),
    visitorIdRef: { current: "visitor_1" },
    sessionToken: "wst_test",
    sessionTokenRef: { current: "wst_test" },
  })),
}));

vi.mock("../hooks/useWidgetSettings", () => ({
  useWidgetSettings: vi.fn(() => ({
    messengerSettings: {
      showLauncher: true,
      primaryColor: "#792cd4",
      backgroundColor: "#ffffff",
      launcherIconUrl: "",
      logo: "",
      welcomeMessage: "Welcome",
      teamIntroduction: "Team intro",
    },
    effectiveTheme: "light",
  })),
}));

vi.mock("../hooks/useEventTracking", () => ({
  useEventTracking: vi.fn(() => ({
    handleTrackEvent: vi.fn(),
  })),
}));

vi.mock("../hooks/useNavigationTracking", () => ({
  useNavigationTracking: vi.fn(),
}));

vi.mock("../utils/dom", () => ({
  checkElementsAvailable: vi.fn(() => true),
}));

describe("Widget new conversation behavior", () => {
  let createConversationMock: ReturnType<typeof vi.fn>;
  let markAsReadMock: ReturnType<typeof vi.fn>;
  let visitorConversationsResult: Array<Record<string, unknown>>;
  let publishedArticlesResult: Array<Record<string, unknown>>;

  const openWidgetMessagesTab = async () => {
    fireEvent.click(screen.getByTestId("widget-launcher"));
    await waitFor(() => {
      expect(screen.queryByTestId("widget-launcher")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Conversations"));
    await waitFor(() => {
      expect(screen.getByTitle("New conversation")).toBeInTheDocument();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedHomeConfig = { enabled: true };

    visitorConversationsResult = [];
    publishedArticlesResult = [];
    createConversationMock = vi.fn().mockResolvedValue({ _id: "conv_created_1" });
    markAsReadMock = vi.fn().mockResolvedValue(undefined);

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      if (mutationRef === "conversations.createForVisitor") {
        return createConversationMock;
      }
      if (mutationRef === "conversations.markAsRead") {
        return markAsReadMock;
      }
      return vi.fn().mockResolvedValue(undefined);
    });

    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseQuery.mockImplementation((queryRef: unknown, args: unknown) => {
      if (args === "skip") {
        return undefined;
      }

      if (queryRef === "workspaces.get") {
        return { _id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
      }

      if (queryRef === "workspaces.validateOrigin") {
        return { valid: true };
      }

      if (queryRef === "conversations.listByVisitor") {
        return visitorConversationsResult;
      }

      if (queryRef === "conversations.getTotalUnreadForVisitor") {
        return 0;
      }

      if (queryRef === "articles.listForVisitor") {
        return publishedArticlesResult;
      }

      if (queryRef === "articles.searchForVisitor") {
        return [];
      }

      if (queryRef === "collections.listHierarchy") {
        return [];
      }

      if (queryRef === "automationSettings.getOrCreate") {
        return {
          suggestArticlesEnabled: false,
          collectEmailEnabled: false,
          showReplyTimeEnabled: false,
          askForRatingEnabled: false,
        };
      }

      if (queryRef === "officeHours.isCurrentlyOpen") {
        return { isOpen: true };
      }

      if (queryRef === "commonIssueButtons.list") {
        return [];
      }

      if (queryRef === "checklists.getEligible") {
        return [];
      }

      if (queryRef === "surveys.getActiveSurveys") {
        return [];
      }

      if (queryRef === "tooltips.getAvailableTooltips") {
        return [];
      }

      return undefined;
    });
  });

  it("reopens the existing draft conversation instead of creating another one", async () => {
    visitorConversationsResult = [
      {
        _id: "conv_draft_1",
        status: "open",
        createdAt: 1700000000000,
        lastMessageAt: 1700000000000,
      },
    ];

    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);
    await openWidgetMessagesTab();

    fireEvent.click(screen.getByTitle("New conversation"));

    await waitFor(() => {
      expect(screen.getByTestId("conversation-view")).toHaveTextContent("conv_draft_1");
    });
    expect(createConversationMock).not.toHaveBeenCalled();
  });

  it("renders only configured tabs and falls back to Messages when Home is hidden", async () => {
    mockedHomeConfig = {
      enabled: true,
      tabs: [
        { id: "messages", enabled: true, visibleTo: "all" },
        { id: "help", enabled: true, visibleTo: "all" },
      ],
    };

    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    fireEvent.click(screen.getByTestId("widget-launcher"));
    await waitFor(() => {
      expect(screen.queryByTestId("widget-launcher")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTitle("New conversation")).toBeInTheDocument();
    });

    expect(screen.getByTitle("Conversations")).toBeInTheDocument();
    expect(screen.getByTitle("Help Center")).toBeInTheDocument();
    expect(screen.queryByTitle("Home")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Product Tours")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Tasks")).not.toBeInTheDocument();
    expect(screen.queryByTitle("My Tickets")).not.toBeInTheDocument();
  });

  it("deduplicates rapid create clicks while a new conversation request is in flight", async () => {
    let resolveCreate:
      | ((value: { _id: string }) => void)
      | undefined;
    const createPromise = new Promise<{ _id: string }>((resolve) => {
      resolveCreate = resolve;
    });
    createConversationMock.mockReturnValue(createPromise);

    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);
    await openWidgetMessagesTab();

    const newConversationButton = screen.getByTitle("New conversation");
    fireEvent.click(newConversationButton);
    fireEvent.click(newConversationButton);

    expect(createConversationMock).toHaveBeenCalledTimes(1);

    resolveCreate?.({ _id: "conv_created_2" });

    await waitFor(() => {
      expect(screen.getByTestId("conversation-view")).toHaveTextContent("conv_created_2");
    });
  });

  it("marks a conversation as read when leaving the chat view", async () => {
    visitorConversationsResult = [
      {
        _id: "conv_unread_1",
        status: "open",
        createdAt: 1700000000000,
        lastMessageAt: 1700000010000,
        unreadByVisitor: 2,
      },
    ];

    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);
    await openWidgetMessagesTab();

    fireEvent.click(screen.getByTestId("mock-open-first-conversation"));
    await waitFor(() => {
      expect(screen.getByTestId("conversation-view")).toHaveTextContent("conv_unread_1");
    });

    expect(markAsReadMock).toHaveBeenCalledWith({
      id: "conv_unread_1",
      readerType: "visitor",
      visitorId: "visitor_1",
      sessionToken: "wst_test",
    });

    fireEvent.click(screen.getByTestId("mock-back-to-list"));
    await waitFor(() => {
      expect(screen.getByTestId("conversation-list")).toBeInTheDocument();
    });

    expect(markAsReadMock).toHaveBeenCalledTimes(2);
  });

  it("expands widget shell for large-screen articles", async () => {
    publishedArticlesResult = [
      {
        _id: "article_large_1",
        title: "Large article",
        content: "Detailed guide",
        widgetLargeScreen: true,
      },
    ];

    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    fireEvent.click(screen.getByTestId("widget-launcher"));
    await waitFor(() => {
      expect(screen.queryByTestId("widget-launcher")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Help Center"));
    fireEvent.click(screen.getByTestId("mock-open-first-article"));

    await waitFor(() => {
      expect(screen.getByTestId("article-detail")).toBeInTheDocument();
    });

    const widgetRoot = document.querySelector(".opencom-widget");
    expect(widgetRoot?.className).toContain("opencom-widget-article-large");
  });
});
