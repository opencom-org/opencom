import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { Widget } from "../Widget";
import { setGetAvailableToursCallback, setStartTourCallback } from "../main";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@opencom/sdk-core", () => ({
  selectSurveyForDelivery: vi.fn(() => null),
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
  Home: () => null,
  useHomeConfig: vi.fn(() => ({ enabled: true })),
}));

vi.mock("../components/ConversationList", () => ({
  ConversationList: () => null,
}));

vi.mock("../components/ConversationView", () => ({
  ConversationView: () => null,
}));

vi.mock("../components/HelpCenter", () => ({
  HelpCenter: () => null,
}));

vi.mock("../components/ArticleDetail", () => ({
  ArticleDetail: () => null,
}));

vi.mock("../components/TourPicker", () => ({
  TourPicker: () => null,
}));

vi.mock("../components/TasksList", () => ({
  TasksList: () => null,
}));

vi.mock("../components/TicketsList", () => ({
  TicketsList: () => null,
}));

vi.mock("../components/TicketDetail", () => ({
  TicketDetail: () => null,
}));

vi.mock("../components/TicketCreate", () => ({
  TicketCreate: () => null,
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

describe("Widget tour callback bridge lifecycle", () => {
  let allToursResult: Array<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    allToursResult = [
      {
        tour: { _id: "tour_1", name: "Demo Tour", description: "Demo" },
        steps: [{ _id: "step_1" }],
        tourStatus: "new",
        elementSelectors: [],
      },
    ];

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));

    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseQuery.mockImplementation((queryRef: unknown, args: unknown) => {
      if (args === "skip") {
        return undefined;
      }

      if (queryRef === "workspaces.get") return { _id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
      if (queryRef === "workspaces.validateOrigin") return { valid: true };
      if (queryRef === "tours.listAll") return allToursResult;
      if (queryRef === "tourProgress.getAvailableTours") return [];
      if (queryRef === "conversations.getTotalUnreadForVisitor") return 0;
      if (queryRef === "conversations.listByVisitor") return [];
      if (queryRef === "articles.searchForVisitor") return [];
      if (queryRef === "articles.listForVisitor") return [];
      if (queryRef === "collections.listHierarchy") return [];
      if (queryRef === "checklists.getEligible") return [];
      if (queryRef === "surveys.getActiveSurveys") return [];
      if (queryRef === "tooltips.getAvailableTooltips") return [];
      if (queryRef === "officeHours.isCurrentlyOpen") return { isOpen: true };
      if (queryRef === "officeHours.getExpectedReplyTime") return null;
      if (queryRef === "automationSettings.getOrCreate") {
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

  it("registers, updates, and cleans up host callbacks", async () => {
    const mockedSetStartTourCallback = setStartTourCallback as unknown as ReturnType<typeof vi.fn>;
    const mockedSetGetAvailableToursCallback =
      setGetAvailableToursCallback as unknown as ReturnType<typeof vi.fn>;

    const { rerender, unmount } = render(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    await waitFor(() => {
      expect(mockedSetStartTourCallback).toHaveBeenCalledWith(expect.any(Function));
      expect(mockedSetGetAvailableToursCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    const initialGetToursCallback = mockedSetGetAvailableToursCallback.mock.calls.find(
      ([arg]) => typeof arg === "function"
    )?.[0] as (() => unknown[]) | undefined;
    expect(initialGetToursCallback?.()[0]).toMatchObject({
      id: "tour_1",
      name: "Demo Tour",
    });

    allToursResult = [
      {
        tour: { _id: "tour_2", name: "Onboarding Tour", description: "Start here" },
        steps: [{ _id: "step_2" }],
        tourStatus: "in_progress",
        elementSelectors: [],
      },
    ];
    rerender(<Widget workspaceId="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />);

    await waitFor(() => {
      const latestRegistration = [...mockedSetGetAvailableToursCallback.mock.calls]
        .reverse()
        .find(([arg]) => typeof arg === "function");
      const latestCallback = latestRegistration?.[0] as (() => unknown[]) | undefined;
      expect(latestCallback?.()[0]).toMatchObject({
        id: "tour_2",
        name: "Onboarding Tour",
      });
    });

    unmount();

    expect(mockedSetStartTourCallback).toHaveBeenLastCalledWith(null);
    expect(mockedSetGetAvailableToursCallback).toHaveBeenLastCalledWith(null);
  });
});
