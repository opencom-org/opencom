import { describe, it, expect, vi } from "vitest";

// Mock the Convex client
vi.mock("convex/react", () => ({
  ConvexReactClient: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    mutation: vi.fn(),
  })),
}));

// Mock the @opencom/convex module
vi.mock("@opencom/convex", () => ({
  api: {
    tickets: {
      create: "tickets:create",
      listByVisitor: "tickets:listByVisitor",
      get: "tickets:get",
      addComment: "tickets:addComment",
      getComments: "tickets:getComments",
    },
    aiAgent: {
      getSettings: "aiAgent:getSettings",
      getPublicSettings: "aiAgent:getPublicSettings",
      getRelevantKnowledge: "aiAgent:getRelevantKnowledge",
      getConversationResponses: "aiAgent:getConversationResponses",
      submitFeedback: "aiAgent:submitFeedback",
      handoffToHuman: "aiAgent:handoffToHuman",
      shouldRespond: "aiAgent:shouldRespond",
    },
    outboundMessages: {
      getEligible: "outboundMessages:getEligible",
      trackImpression: "outboundMessages:trackImpression",
    },
    checklists: {
      getEligible: "checklists:getEligible",
      getProgress: "checklists:getProgress",
      completeTask: "checklists:completeTask",
    },
    officeHours: {
      isCurrentlyOpen: "officeHours:isCurrentlyOpen",
      getExpectedReplyTime: "officeHours:getExpectedReplyTime",
      getOrDefault: "officeHours:getOrDefault",
    },
    commonIssueButtons: {
      list: "commonIssueButtons:list",
    },
    widgetSessions: {
      boot: "widgetSessions:boot",
      refresh: "widgetSessions:refresh",
      revoke: "widgetSessions:revoke",
    },
  },
}));

describe("SDK Core API Types", () => {
  describe("Tickets API Types", () => {
    it("should export ticket types", async () => {
      const module = await import("../src/api/tickets");
      // Types are compile-time only, so we just verify the module loads
      expect(module).toBeDefined();
    });
  });

  describe("AI Agent API Types", () => {
    it("should export AI agent types", async () => {
      const module = await import("../src/api/aiAgent");
      expect(module).toBeDefined();
    });
  });

  describe("Outbound API Types", () => {
    it("should export outbound message types", async () => {
      const module = await import("../src/api/outbound");
      expect(module).toBeDefined();
    });
  });

  describe("Checklists API Types", () => {
    it("should export checklist types", async () => {
      const module = await import("../src/api/checklists");
      expect(module).toBeDefined();
    });
  });

  describe("Office Hours API Types", () => {
    it("should export office hours types", async () => {
      const module = await import("../src/api/officeHours");
      expect(module).toBeDefined();
    });
  });

  describe("Common Issues API Types", () => {
    it("should export common issue button types", async () => {
      const module = await import("../src/api/commonIssues");
      expect(module).toBeDefined();
    });
  });

  describe("Sessions API Types", () => {
    it("should export sessions functions", async () => {
      const module = await import("../src/api/sessions");
      expect(module.bootSession).toBeDefined();
      expect(module.refreshSession).toBeDefined();
      expect(module.revokeSession).toBeDefined();
    });
  });
});

describe("API Index Exports", () => {
  it("should export all API modules from index", async () => {
    const apiIndex = await import("../src/api");

    // Check tickets exports
    expect(apiIndex.createTicket).toBeDefined();
    expect(apiIndex.listTickets).toBeDefined();
    expect(apiIndex.getTicket).toBeDefined();
    expect(apiIndex.addTicketComment).toBeDefined();

    // Check AI agent exports
    expect(apiIndex.getAISettings).toBeDefined();
    expect(apiIndex.getRelevantKnowledge).toBeDefined();
    expect(apiIndex.submitAIFeedback).toBeDefined();
    expect(apiIndex.handoffToHuman).toBeDefined();

    // Check outbound exports
    expect(apiIndex.getActiveOutboundMessages).toBeDefined();
    expect(apiIndex.trackOutboundImpression).toBeDefined();
    expect(apiIndex.markOutboundAsSeen).toBeDefined();

    // Check checklists exports
    expect(apiIndex.getEligibleChecklists).toBeDefined();
    expect(apiIndex.getChecklistProgress).toBeDefined();
    expect(apiIndex.completeChecklistItem).toBeDefined();

    // Check office hours exports
    expect(apiIndex.getOfficeHoursStatus).toBeDefined();
    expect(apiIndex.getExpectedReplyTime).toBeDefined();
    expect(apiIndex.getOfficeHours).toBeDefined();

    // Check common issues exports
    expect(apiIndex.getCommonIssueButtons).toBeDefined();

    // Check sessions exports
    expect(apiIndex.bootSession).toBeDefined();
    expect(apiIndex.refreshSession).toBeDefined();
    expect(apiIndex.revokeSession).toBeDefined();
  });
});
