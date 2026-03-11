import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { Widget } from "../Widget";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
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

    const symbolFunctionName = Object.getOwnPropertySymbols(ref).find((symbol) =>
      String(symbol).includes("functionName")
    );

    const symbolValue = symbolFunctionName
      ? (ref as Record<symbol, unknown>)[symbolFunctionName]
      : undefined;

    return (
      (typeof symbolValue === "string" ? symbolValue : undefined) ??
      maybeRef.functionName ??
      maybeRef.name ??
      maybeRef.reference?.functionName ??
      maybeRef.reference?.name ??
      ""
    );
  }

  return "";
}

vi.mock("@opencom/sdk-core", () => ({
  selectSurveyForDelivery: vi.fn((surveys: unknown[]) => surveys[0] ?? null),
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
      getForVisitor: "articles.getForVisitor",
      searchForVisitor: "articles.searchForVisitor",
      listForVisitor: "articles.listForVisitor",
    },
    collections: {
      listHierarchyForVisitor: "collections.listHierarchyForVisitor",
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

let outboundState = { hasPendingPost: true, hasActivePost: false };

vi.mock("../TourOverlay", () => ({
  TourOverlay: ({ allowBlockingTour }: { allowBlockingTour: boolean }) => (
    <div data-testid="tour-overlay-state" data-allow={allowBlockingTour ? "yes" : "no"} />
  ),
}));

vi.mock("../OutboundOverlay", () => ({
  OutboundOverlay: ({
    allowBlockingPost,
    onBlockingStateChange,
  }: {
    allowBlockingPost: boolean;
    onBlockingStateChange?: (state: { hasPendingPost: boolean; hasActivePost: boolean }) => void;
  }) => {
    useEffect(() => {
      onBlockingStateChange?.(outboundState);
    }, [onBlockingStateChange]);

    return <div data-testid="outbound-overlay-state" data-allow={allowBlockingPost ? "yes" : "no"} />;
  },
}));

vi.mock("../TooltipOverlay", () => ({
  TooltipOverlay: () => null,
}));

vi.mock("../SurveyOverlay", () => ({
  SurveyOverlay: () => <div data-testid="survey-overlay" />,
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

describe("Widget shell orchestration", () => {
  let workspaceValidationResult: unknown;
  let originValidationResult: { valid: boolean; reason?: string };
  let availableToursResult: Array<Record<string, unknown>>;
  let activeSurveysResult: Array<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    outboundState = { hasPendingPost: true, hasActivePost: false };
    workspaceValidationResult = { _id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
    originValidationResult = { valid: true };
    availableToursResult = [
      {
        tour: { _id: "tour_1" },
        steps: [{ _id: "step_1" }],
        progress: { currentStep: 0, status: "new" },
      },
    ];
    activeSurveysResult = [
      {
        _id: "survey_large_1",
        format: "large",
      },
    ];

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));

    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseQuery.mockImplementation((queryRef: unknown, args: unknown) => {
      const functionPath = getFunctionPath(queryRef);

      if (args === "skip") {
        return undefined;
      }

      if (functionPath === "workspaces:get" || functionPath === "workspaces.get") {
        return workspaceValidationResult;
      }
      if (functionPath === "workspaces:validateOrigin" || functionPath === "workspaces.validateOrigin") {
        return originValidationResult;
      }
      if (
        functionPath === "tourProgress:getAvailableTours" ||
        functionPath === "tourProgress.getAvailableTours"
      ) {
        return availableToursResult;
      }
      if (functionPath === "surveys:getActiveSurveys" || functionPath === "surveys.getActiveSurveys") {
        return activeSurveysResult;
      }
      if (functionPath === "tours:listAll" || functionPath === "tours.listAll") {
        return [
          {
            tour: { _id: "tour_1", name: "Demo Tour", description: "Demo" },
            steps: [{ _id: "step_1" }],
            tourStatus: "new",
            elementSelectors: [],
          },
        ];
      }

      if (
        functionPath === "conversations:getTotalUnreadForVisitor" ||
        functionPath === "conversations.getTotalUnreadForVisitor"
      ) {
        return 0;
      }
      if (
        functionPath === "conversations:listByVisitor" ||
        functionPath === "conversations.listByVisitor"
      ) {
        return [];
      }
      if (functionPath === "articles:searchForVisitor" || functionPath === "articles.searchForVisitor") {
        return [];
      }
      if (functionPath === "articles:listForVisitor" || functionPath === "articles.listForVisitor") {
        return [];
      }
      if (
        functionPath === "collections:listHierarchyForVisitor" ||
        functionPath === "collections.listHierarchyForVisitor"
      ) {
        return [];
      }
      if (functionPath === "checklists:getEligible" || functionPath === "checklists.getEligible") {
        return [];
      }
      if (
        functionPath === "tooltips:getAvailableTooltips" ||
        functionPath === "tooltips.getAvailableTooltips"
      ) {
        return [];
      }
      if (functionPath === "officeHours:isCurrentlyOpen" || functionPath === "officeHours.isCurrentlyOpen") {
        return { isOpen: true };
      }
      if (
        functionPath === "officeHours:getExpectedReplyTime" ||
        functionPath === "officeHours.getExpectedReplyTime"
      ) {
        return null;
      }
      if (
        functionPath === "automationSettings:getOrCreate" ||
        functionPath === "automationSettings.getOrCreate"
      ) {
        return {
          suggestArticlesEnabled: false,
          collectEmailEnabled: false,
          showReplyTimeEnabled: false,
          askForRatingEnabled: false,
        };
      }

      return undefined;
    });
  });

  it("renders widget error surface when workspace validation fails", async () => {
    workspaceValidationResult = null;
    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    await waitFor(() => {
      expect(screen.getByText("Widget Error: Workspace not found")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("widget-launcher")).not.toBeInTheDocument();
  });

  it("short-circuits rendering when origin validation fails", async () => {
    originValidationResult = { valid: false, reason: "Invalid origin" };
    const { container } = render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
