import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { Widget } from "../Widget";

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
  useHomeConfig: vi.fn(() => ({ enabled: true })),
}));

vi.mock("../components/ConversationList", () => ({
  ConversationList: () => <div data-testid="conversation-list" />,
}));

vi.mock("../components/ConversationView", () => ({
  ConversationView: ({ conversationId }: { conversationId: string }) => (
    <div data-testid="conversation-view">{conversationId}</div>
  ),
}));

vi.mock("../components/HelpCenter", () => ({
  HelpCenter: () => <div data-testid="help-center" />,
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
  let visitorConversationsResult: Array<Record<string, unknown>>;

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

    visitorConversationsResult = [];
    createConversationMock = vi.fn().mockResolvedValue({ _id: "conv_created_1" });

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      if (mutationRef === "conversations.createForVisitor") {
        return createConversationMock;
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
});
