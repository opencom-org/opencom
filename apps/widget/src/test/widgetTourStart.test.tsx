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
  ConversationView: () => <div data-testid="conversation-view" />,
}));

vi.mock("../components/HelpCenter", () => ({
  HelpCenter: () => <div data-testid="help-center" />,
}));

vi.mock("../components/ArticleDetail", () => ({
  ArticleDetail: () => <div data-testid="article-detail" />,
}));

vi.mock("../components/TourPicker", () => ({
  TourPicker: ({ onSelectTour }: { onSelectTour: (tourId: string) => void }) => (
    <button type="button" onClick={() => onSelectTour("tour_1")}>
      Start demo tour
    </button>
  ),
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
  TourOverlay: ({
    forcedTourId,
    onBlockingActiveChange,
  }: {
    forcedTourId?: string | null;
    onBlockingActiveChange?: (isActive: boolean) => void;
  }) => (
    <div>
      <div data-testid="tour-overlay-mock">{forcedTourId ?? ""}</div>
      <button type="button" data-testid="tour-overlay-activate" onClick={() => onBlockingActiveChange?.(true)}>
        Activate tour
      </button>
    </div>
  ),
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

describe("Widget tour launch behavior", () => {
  let availableToursResult: unknown[];

  beforeEach(() => {
    vi.clearAllMocks();
    availableToursResult = [];

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));

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

      if (queryRef === "tourProgress.getAvailableTours") {
        return availableToursResult;
      }

      if (queryRef === "tours.listAll") {
        return [
          {
            tour: {
              _id: "tour_1",
              name: "Demo Tour",
              description: "Demo",
            },
            steps: [{ _id: "step_1" }],
            tourStatus: "new",
            elementSelectors: [],
          },
        ];
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

  it("closes the widget before starting a tour from the tours tab", async () => {
    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    const launcher = screen.getByTestId("widget-launcher");
    fireEvent.click(launcher);

    await waitFor(() => {
      expect(screen.queryByTestId("widget-launcher")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Product Tours"));
    fireEvent.click(screen.getByRole("button", { name: "Start demo tour" }));

    await waitFor(() => {
      expect(screen.getByTestId("widget-launcher")).toBeVisible();
      expect(screen.getByTestId("tour-overlay-mock")).toHaveTextContent("tour_1");
    });
  });

  it("closes the widget when a tour becomes active after opening", async () => {
    availableToursResult = [
      {
        tour: {
          _id: "tour_auto_1",
          name: "Automatic Tour",
          description: "Auto",
        },
        steps: [{ _id: "step_auto_1" }],
        progress: { currentStep: 0, status: "new" },
      },
    ];

    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    fireEvent.click(screen.getByTestId("widget-launcher"));

    await waitFor(() => {
      expect(screen.queryByTestId("widget-launcher")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tour-overlay-activate"));

    await waitFor(() => {
      expect(screen.getByTestId("widget-launcher")).toBeVisible();
      expect(screen.queryByTestId("conversation-list")).not.toBeInTheDocument();
    });
  });
});
