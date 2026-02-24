import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  expectAuthError,
  expectAuthorizationError,
  expectOwnershipError,
} from "./helpers/securityAssertions";
import {
  AuthenticatedAgentContext,
  VisitorSessionBundle,
  createAuthenticatedAgentContext,
  createVisitorSessionBundle,
} from "./helpers/securityContexts";
import { cleanupTestData, createTestConversation, createTestSurvey } from "./helpers/testHelpers";

describe("security regression coverage (admin auth + visitor ownership)", () => {
  let unauthClient: ConvexClient;
  let agentA: AuthenticatedAgentContext;
  let agentB: AuthenticatedAgentContext;
  let visitorsA: VisitorSessionBundle;
  let visitorsB: VisitorSessionBundle;

  let tourA: Id<"tours">;
  let tourB: Id<"tours">;
  let conversationA: Id<"conversations">;
  let ticketA: Id<"tickets">;
  let outboundMessageA: Id<"outboundMessages">;
  let carouselA: Id<"carousels">;
  let checklistA: Id<"checklists">;
  let surveyA: Id<"surveys">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL?.trim();
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    unauthClient = new ConvexClient(convexUrl);
    agentA = await createAuthenticatedAgentContext();
    agentB = await createAuthenticatedAgentContext();

    visitorsA = await createVisitorSessionBundle(agentA.client, agentA.workspaceId);
    visitorsB = await createVisitorSessionBundle(agentB.client, agentB.workspaceId);

    tourA = await agentA.client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: agentA.workspaceId,
      name: "Security Visitor Ownership Tour",
    });
    await agentA.client.mutation(api.tourSteps.create, {
      tourId: tourA,
      type: "post",
      content: "Tour step 1",
    });
    await agentA.client.mutation(api.testing.helpers.activateTestTour, { id: tourA });

    tourB = await agentB.client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: agentB.workspaceId,
      name: "Cross Workspace Tour",
    });

    const conversation = await createTestConversation(agentA.client, {
      workspaceId: agentA.workspaceId,
      visitorId: visitorsA.primary.visitorId,
    });
    conversationA = conversation.conversationId;

    ticketA = await unauthClient.mutation(api.tickets.create, {
      workspaceId: agentA.workspaceId,
      visitorId: visitorsA.primary.visitorId,
      sessionToken: visitorsA.primary.sessionToken,
      subject: "Security Ownership Ticket",
      description: "Seed ticket for ownership checks",
      priority: "normal",
    });

    outboundMessageA = await agentA.client.mutation(api.outboundMessages.create, {
      workspaceId: agentA.workspaceId,
      type: "chat",
      name: "Security Outbound",
      content: { text: "Security test outbound" },
    });
    await agentA.client.mutation(api.outboundMessages.activate, { id: outboundMessageA });

    carouselA = await agentA.client.mutation(api.carousels.create, {
      workspaceId: agentA.workspaceId,
      name: "Security Carousel",
      screens: [{ id: "screen-1", title: "Welcome", body: "Security coverage" }],
    });
    await agentA.client.mutation(api.carousels.activate, { id: carouselA });

    checklistA = await agentA.client.mutation(api.checklists.create, {
      workspaceId: agentA.workspaceId,
      name: "Security Checklist",
      tasks: [
        {
          id: "task-security-1",
          title: "Complete setup",
          completionType: "manual",
        },
      ],
    });
    await agentA.client.mutation(api.checklists.update, {
      id: checklistA,
      status: "active",
    });

    surveyA = (
      await createTestSurvey(agentA.client, {
        workspaceId: agentA.workspaceId,
        status: "active",
      })
    ).surveyId;

    await unauthClient.mutation(api.tourProgress.start, {
      workspaceId: agentA.workspaceId,
      visitorId: visitorsA.primary.visitorId,
      sessionToken: visitorsA.primary.sessionToken,
      tourId: tourA,
    });
  });

  afterAll(async () => {
    const workspaceIds = new Set<Id<"workspaces">>([
      agentA.workspaceId,
      agentB.workspaceId,
      visitorsA.crossWorkspace.workspaceId,
      visitorsB.crossWorkspace.workspaceId,
    ]);

    for (const workspaceId of workspaceIds) {
      try {
        await cleanupTestData(unauthClient, { workspaceId });
      } catch (error) {
        console.warn("Cleanup failed for workspace", workspaceId, error);
      }
    }

    await unauthClient.close();
    await agentA.client.close();
    await agentB.client.close();
  });

  describe("admin authorization negative coverage", () => {
    it("rejects unauthenticated hardened admin mutations", async () => {
      const unauthMutations: Array<() => Promise<unknown>> = [
        () =>
          unauthClient.mutation(api.emailCampaigns.create, {
            workspaceId: agentA.workspaceId,
            name: "NoAuth Campaign",
            subject: "Subject",
            content: "Body",
          }),
        () =>
          unauthClient.mutation(api.outboundMessages.create, {
            workspaceId: agentA.workspaceId,
            type: "chat",
            name: "NoAuth Outbound",
            content: { text: "Hello" },
          }),
        () =>
          unauthClient.mutation(api.carousels.create, {
            workspaceId: agentA.workspaceId,
            name: "NoAuth Carousel",
            screens: [{ id: "screen-1", title: "A", body: "B" }],
          }),
        () =>
          unauthClient.mutation(api.internalArticles.create, {
            workspaceId: agentA.workspaceId,
            title: "NoAuth Internal",
            content: "Body",
          }),
        () =>
          unauthClient.mutation(api.contentFolders.create, {
            workspaceId: agentA.workspaceId,
            name: "NoAuth Folder",
          }),
        () =>
          unauthClient.mutation(api.emailTemplates.create, {
            workspaceId: agentA.workspaceId,
            name: "NoAuth Template",
            html: "<p>Hello</p>",
          }),
        () =>
          unauthClient.mutation(api.collections.create, {
            workspaceId: agentA.workspaceId,
            name: "NoAuth Collection",
          }),
        () =>
          unauthClient.mutation(api.tooltips.create, {
            workspaceId: agentA.workspaceId,
            name: "NoAuth Tooltip",
            elementSelector: "#cta",
            content: "Click this",
            triggerType: "click",
          }),
        () =>
          unauthClient.mutation(api.tourSteps.create, {
            tourId: tourA,
            type: "post",
            content: "NoAuth Tour Step",
          }),
        () =>
          unauthClient.mutation(api.snippets.create, {
            workspaceId: agentA.workspaceId,
            name: "NoAuth Snippet",
            content: "Hello",
          }),
      ];

      for (const mutationCall of unauthMutations) {
        await expectAuthError(mutationCall());
      }
    });

    it("rejects cross-workspace admin calls for authenticated agents", async () => {
      const crossWorkspaceCalls: Array<() => Promise<unknown>> = [
        () =>
          agentA.client.mutation(api.emailCampaigns.create, {
            workspaceId: agentB.workspaceId,
            name: "Cross Campaign",
            subject: "Subject",
            content: "Body",
          }),
        () =>
          agentA.client.mutation(api.outboundMessages.create, {
            workspaceId: agentB.workspaceId,
            type: "chat",
            name: "Cross Outbound",
            content: { text: "Hello" },
          }),
        () =>
          agentA.client.mutation(api.carousels.create, {
            workspaceId: agentB.workspaceId,
            name: "Cross Carousel",
            screens: [{ id: "screen-1", title: "A", body: "B" }],
          }),
        () =>
          agentA.client.mutation(api.internalArticles.create, {
            workspaceId: agentB.workspaceId,
            title: "Cross Internal",
            content: "Body",
          }),
        () =>
          agentA.client.mutation(api.contentFolders.create, {
            workspaceId: agentB.workspaceId,
            name: "Cross Folder",
          }),
        () =>
          agentA.client.mutation(api.emailTemplates.create, {
            workspaceId: agentB.workspaceId,
            name: "Cross Template",
            html: "<p>Hello</p>",
          }),
        () =>
          agentA.client.mutation(api.collections.create, {
            workspaceId: agentB.workspaceId,
            name: "Cross Collection",
          }),
        () =>
          agentA.client.mutation(api.tooltips.create, {
            workspaceId: agentB.workspaceId,
            name: "Cross Tooltip",
            elementSelector: "#cta",
            content: "Click this",
            triggerType: "hover",
          }),
        () =>
          agentA.client.mutation(api.tourSteps.create, {
            tourId: tourB,
            type: "post",
            content: "Cross Tour Step",
          }),
        () =>
          agentA.client.mutation(api.snippets.create, {
            workspaceId: agentB.workspaceId,
            name: "Cross Snippet",
            content: "Hello",
          }),
        () =>
          agentA.client.query(api.articles.list, {
            workspaceId: agentB.workspaceId,
          }),
        () =>
          agentA.client.query(api.knowledge.search, {
            workspaceId: agentB.workspaceId,
            query: "policy",
          }),
        () =>
          agentA.client.mutation(api.aiAgent.updateSettings, {
            workspaceId: agentB.workspaceId,
            enabled: true,
          }),
      ];

      for (const crossWorkspaceCall of crossWorkspaceCalls) {
        await expectAuthorizationError(crossWorkspaceCall());
      }
    });
  });

  describe("visitor ownership and anti-impersonation coverage", () => {
    it("rejects forged visitor identity and metadata for ticket comments", async () => {
      const forgedCommentId = await unauthClient.mutation(api.tickets.addComment, {
        ticketId: ticketA,
        visitorId: visitorsA.primary.visitorId,
        sessionToken: visitorsA.primary.sessionToken,
        content: "Forged metadata attempt",
        authorId: agentA.userId,
        authorType: "agent",
        isInternal: true,
      });

      const comments = await agentA.client.query(api.tickets.getComments, {
        ticketId: ticketA,
        includeInternal: true,
      });
      const forgedComment = comments.find((comment) => comment._id === forgedCommentId);

      expect(forgedComment).toBeDefined();
      expect(forgedComment?.authorType).toBe("visitor");
      expect(forgedComment?.isInternal).toBe(false);
      expect(forgedComment?.authorId).toBe(visitorsA.primary.visitorId);

      await expectOwnershipError(
        unauthClient.mutation(api.tickets.addComment, {
          ticketId: ticketA,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.alternate.sessionToken,
          content: "Should fail visitor mismatch",
        })
      );
    });

    it("enforces visitor ownership on tour progress mutations", async () => {
      await expectOwnershipError(
        unauthClient.mutation(api.tourProgress.advance, {
          workspaceId: agentA.workspaceId,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.alternate.sessionToken,
          tourId: tourA,
        })
      );
    });

    it("enforces visitor ownership for outbound message visitor paths", async () => {
      await expectOwnershipError(
        unauthClient.query(api.outboundMessages.getEligible, {
          workspaceId: agentA.workspaceId,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.crossWorkspace.context.sessionToken,
          currentUrl: "https://example.com/pricing",
          sessionId: "security-session-1",
        })
      );

      await expectOwnershipError(
        unauthClient.mutation(api.outboundMessages.trackImpression, {
          messageId: outboundMessageA,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.alternate.sessionToken,
          action: "shown",
          sessionId: "security-session-1",
        })
      );
    });

    it("enforces visitor ownership for carousel visitor paths", async () => {
      await expectOwnershipError(
        unauthClient.query(api.carousels.getEligible, {
          workspaceId: agentA.workspaceId,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.crossWorkspace.context.sessionToken,
        })
      );

      await expectOwnershipError(
        unauthClient.mutation(api.carousels.trackImpression, {
          carouselId: carouselA,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.alternate.sessionToken,
          action: "shown",
          screenIndex: 0,
        })
      );
    });

    it("enforces visitor ownership for surveys and checklists visitor paths", async () => {
      await expectOwnershipError(
        unauthClient.mutation(api.surveys.submitResponse, {
          surveyId: surveyA,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.crossWorkspace.context.sessionToken,
          answers: [{ questionId: "q1", value: 9 }],
          isComplete: true,
        })
      );

      await expectOwnershipError(
        unauthClient.mutation(api.surveys.recordImpression, {
          surveyId: surveyA,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.crossWorkspace.context.sessionToken,
          action: "shown",
        })
      );

      await expectOwnershipError(
        unauthClient.query(api.checklists.getEligible, {
          workspaceId: agentA.workspaceId,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.crossWorkspace.context.sessionToken,
        })
      );

      await expectOwnershipError(
        unauthClient.mutation(api.checklists.completeTask, {
          workspaceId: agentA.workspaceId,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.crossWorkspace.context.sessionToken,
          checklistId: checklistA,
          taskId: "task-security-1",
        })
      );
    });

    it("enforces visitor ownership for AI conversation response paths", async () => {
      await expectOwnershipError(
        unauthClient.query(api.aiAgent.getConversationResponses, {
          conversationId: conversationA,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.alternate.sessionToken,
        })
      );

      await expectOwnershipError(
        unauthClient.action(api.aiAgentActions.generateResponse, {
          workspaceId: agentA.workspaceId,
          conversationId: conversationA,
          visitorId: visitorsA.primary.visitorId,
          sessionToken: visitorsA.alternate.sessionToken,
          query: "Can you help me with billing?",
        })
      );
    });
  });
});
