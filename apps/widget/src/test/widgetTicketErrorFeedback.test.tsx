import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  useHomeConfig: vi.fn(() => ({
    enabled: true,
    tabs: [
      { id: "home", enabled: true, visibleTo: "all" },
      { id: "messages", enabled: true, visibleTo: "all" },
      { id: "help", enabled: true, visibleTo: "all" },
      { id: "tickets", enabled: true, visibleTo: "all" },
    ],
  })),
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
  TicketCreate: ({
    onSubmit,
    errorFeedback,
  }: {
    onSubmit: (data: Record<string, unknown>) => Promise<void>;
    errorFeedback: { message: string; nextAction?: string } | null;
  }) => (
    <div data-testid="ticket-create">
      {errorFeedback && (
        <div data-testid="ticket-error">
          <span>{errorFeedback.message}</span>
          <span>{errorFeedback.nextAction}</span>
        </div>
      )}
      <button type="button" data-testid="ticket-submit-empty" onClick={() => void onSubmit({ subject: "   " })}>
        Submit Empty
      </button>
      <button
        type="button"
        data-testid="ticket-submit-valid"
        onClick={() => void onSubmit({ subject: "Need help" })}
      >
        Submit Valid
      </button>
    </div>
  ),
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

describe("Widget ticket error feedback", () => {
  let createTicketMock: ReturnType<typeof vi.fn>;

  const openTicketCreateView = async () => {
    render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    fireEvent.click(screen.getByTestId("widget-launcher"));
    await waitFor(() => {
      expect(screen.queryByTestId("widget-launcher")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("My Tickets"));
    fireEvent.click(screen.getByRole("button", { name: /new ticket/i }));

    await waitFor(() => {
      expect(screen.getByTestId("ticket-create")).toBeInTheDocument();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createTicketMock = vi.fn().mockResolvedValue("ticket_1");

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      const functionPath = getFunctionPath(mutationRef);

      if (functionPath === "tickets:create" || functionPath === "tickets.create") {
        return createTicketMock;
      }

      return vi.fn().mockResolvedValue(undefined);
    });

    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseQuery.mockImplementation((queryRef: unknown, args: unknown) => {
      const functionPath = getFunctionPath(queryRef);

      if (args === "skip") {
        return undefined;
      }
      if (functionPath === "workspaces:get" || functionPath === "workspaces.get") {
        return { _id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
      }
      if (functionPath === "workspaces:validateOrigin" || functionPath === "workspaces.validateOrigin") {
        return { valid: true };
      }
      if (functionPath === "tickets:listByVisitor" || functionPath === "tickets.listByVisitor") {
        return [];
      }
      if (functionPath === "tickets:get" || functionPath === "tickets.get") {
        return null;
      }
      if (
        functionPath === "ticketForms:getDefaultForVisitor" ||
        functionPath === "ticketForms.getDefaultForVisitor"
      ) {
        return { _id: "ticket_form_1", fields: [] };
      }
      if (
        functionPath === "conversations:listByVisitor" ||
        functionPath === "conversations.listByVisitor"
      ) {
        return [];
      }
      if (
        functionPath === "conversations:getTotalUnreadForVisitor" ||
        functionPath === "conversations.getTotalUnreadForVisitor"
      ) {
        return 0;
      }
      if (functionPath === "articles:listForVisitor" || functionPath === "articles.listForVisitor") {
        return [];
      }
      if (
        functionPath === "articles:searchForVisitor" ||
        functionPath === "articles.searchForVisitor"
      ) {
        return [];
      }
      if (
        functionPath === "collections:listHierarchyForVisitor" ||
        functionPath === "collections.listHierarchyForVisitor"
      ) {
        return [];
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
      if (functionPath === "commonIssueButtons:list" || functionPath === "commonIssueButtons.list") {
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
        functionPath === "tourProgress:getAvailableTours" ||
        functionPath === "tourProgress.getAvailableTours"
      ) {
        return [];
      }
      if (functionPath === "tours:listAll" || functionPath === "tours.listAll") {
        return [];
      }
      if (functionPath === "checklists:getEligible" || functionPath === "checklists.getEligible") {
        return [];
      }
      if (functionPath === "surveys:getActiveSurveys" || functionPath === "surveys.getActiveSurveys") {
        return [];
      }
      if (
        functionPath === "tooltips:getAvailableTooltips" ||
        functionPath === "tooltips.getAvailableTooltips"
      ) {
        return [];
      }
      return undefined;
    });
  });

  it("shows actionable validation guidance instead of browser alert for empty subject", async () => {
    await openTicketCreateView();

    fireEvent.click(screen.getByTestId("ticket-submit-empty"));

    await waitFor(() => {
      expect(screen.getByTestId("ticket-error")).toHaveTextContent(
        "Please provide a subject for your ticket."
      );
    });
    expect(screen.getByTestId("ticket-error")).toHaveTextContent(
      "Add a short subject, then submit again."
    );
    expect(createTicketMock).not.toHaveBeenCalled();
  });

  it("surfaces normalized mutation errors with retry guidance", async () => {
    createTicketMock.mockRejectedValue(new Error("Ticket service unavailable"));
    await openTicketCreateView();

    fireEvent.click(screen.getByTestId("ticket-submit-valid"));

    await waitFor(() => {
      expect(screen.getByTestId("ticket-error")).toHaveTextContent("Ticket service unavailable");
    });
    expect(screen.getByTestId("ticket-error")).toHaveTextContent("Please try again.");
  });
});
