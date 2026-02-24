import { Id } from "@opencom/convex/dataModel";
import { resolveE2EBackendUrl } from "./e2e-env";

/**
 * Test Data Helper
 * Provides utilities for seeding and cleaning up test data via Convex internal mutations.
 *
 * All test data mutations are `internalMutation` — they are called through
 * the public `testAdmin:runTestMutation` action which validates a shared secret
 * (TEST_ADMIN_SECRET env var).
 */

export const E2E_TEST_EMAIL_DOMAIN = "test.opencom.dev";

const BACKEND_URL = resolveE2EBackendUrl();

function getAdminSecret(): string {
  const secret = process.env.TEST_ADMIN_SECRET;
  if (!secret) {
    throw new Error(
      "TEST_ADMIN_SECRET is required for E2E test data operations. " +
        "All test mutations are internal and require the admin gateway secret."
    );
  }
  return secret;
}

/**
 * Calls a Convex internal mutation via the testAdmin gateway action.
 */
async function callInternalMutation<T>(path: string, args: Record<string, unknown>): Promise<T> {
  const url = `${BACKEND_URL}/api/action`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: "testAdmin:runTestMutation",
      args: { secret: getAdminSecret(), name: path, mutationArgs: args },
      format: "json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex mutation ${path} failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.status === "success") return json.value as T;
  if (json.status === "error")
    throw new Error(`Convex mutation ${path} error: ${json.errorMessage}`);
  return json as T;
}

async function callPublicMutation<T>(path: string, args: Record<string, unknown>): Promise<T> {
  const url = `${BACKEND_URL}/api/mutation`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path,
      args,
      format: "json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex public mutation ${path} failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.status === "success") return json.value as T;
  if (json.status === "error")
    throw new Error(`Convex public mutation ${path} error: ${json.errorMessage}`);
  return json as T;
}

async function callPublicQuery<T>(path: string, args: Record<string, unknown>): Promise<T> {
  const url = `${BACKEND_URL}/api/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path,
      args,
      format: "json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex public query ${path} failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.status === "success") return json.value as T;
  if (json.status === "error")
    throw new Error(`Convex public query ${path} error: ${json.errorMessage}`);
  return json as T;
}

export async function getPublicWorkspaceContext(): Promise<{
  _id: Id<"workspaces">;
  name: string;
  helpCenterAccessPolicy: "public" | "restricted";
} | null> {
  return await callPublicQuery("workspaces:getPublicWorkspaceContext", {});
}

type InboxSenderType = "visitor" | "agent" | "bot";

/**
 * Creates a test workspace for E2E testing.
 */
export async function createTestWorkspace(name?: string): Promise<{
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  name: string;
}> {
  return await callInternalMutation("testing/helpers:createTestWorkspace", { name });
}

/**
 * Seeds a deterministic audit log entry for E2E validation flows.
 */
export async function createTestAuditLog(
  workspaceId: Id<"workspaces">,
  options: {
    action: string;
    actorType?: "user" | "system" | "api";
    actorId?: Id<"users">;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    timestamp?: number;
  }
): Promise<{ logId: Id<"auditLogs">; timestamp: number }> {
  return await callInternalMutation("testing/helpers:createTestAuditLog", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds a test tour with steps.
 */
export async function seedTour(
  workspaceId: Id<"workspaces">,
  options?: {
    name?: string;
    status?: "draft" | "active" | "archived";
    targetPageUrl?: string;
    steps?: Array<{
      type: "pointer" | "post" | "video";
      title?: string;
      content: string;
      elementSelector?: string;
      routePath?: string;
      advanceOn?: "click" | "elementClick" | "fieldFill";
      position?: "auto" | "left" | "right" | "above" | "below";
      size?: "small" | "large";
    }>;
  }
): Promise<{
  tourId: Id<"tours">;
  stepIds: Id<"tourSteps">[];
  name: string;
}> {
  return await callInternalMutation("testData:seedTour", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds a test survey with questions.
 */
export async function seedSurvey(
  workspaceId: Id<"workspaces">,
  options?: {
    name?: string;
    format?: "small" | "large";
    status?: "draft" | "active" | "paused" | "archived";
    questionType?:
      | "nps"
      | "numeric_scale"
      | "star_rating"
      | "emoji_rating"
      | "short_text"
      | "multiple_choice";
    triggerType?: "immediate" | "page_visit" | "time_on_page" | "event";
    triggerPageUrl?: string;
  }
): Promise<{
  surveyId: Id<"surveys">;
  name: string;
  questionId: string;
}> {
  return await callInternalMutation("testData:seedSurvey", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds a test carousel with slides.
 */
export async function seedCarousel(
  workspaceId: Id<"workspaces">,
  options?: {
    name?: string;
    status?: "draft" | "active" | "paused" | "archived";
    screens?: Array<{
      title?: string;
      body?: string;
      imageUrl?: string;
    }>;
  }
): Promise<{
  carouselId: Id<"carousels">;
  name: string;
}> {
  return await callInternalMutation("testData:seedCarousel", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds a test outbound message.
 */
export async function seedOutboundMessage(
  workspaceId: Id<"workspaces">,
  options?: {
    name?: string;
    type?: "chat" | "post" | "banner";
    status?: "draft" | "active" | "paused" | "archived";
    triggerType?: "immediate" | "page_visit" | "time_on_page" | "scroll_depth" | "event";
    triggerPageUrl?: string;
    senderId?: Id<"users">;
  }
): Promise<{
  messageId: Id<"outboundMessages">;
  name: string;
}> {
  return await callInternalMutation("testData:seedOutboundMessage", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds test articles in a collection.
 */
export async function seedArticles(
  workspaceId: Id<"workspaces">,
  options?: {
    collectionName?: string;
    articleCount?: number;
    includesDraft?: boolean;
  }
): Promise<{
  collectionId: Id<"collections">;
  collectionName: string;
  articleIds: Id<"articles">[];
}> {
  return await callInternalMutation("testData:seedArticles", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds a test visitor with custom attributes.
 */
export async function seedVisitor(
  workspaceId: Id<"workspaces">,
  options?: {
    email?: string;
    name?: string;
    externalUserId?: string;
    customAttributes?: Record<string, unknown>;
    location?: {
      city?: string;
      region?: string;
      country?: string;
      countryCode?: string;
    };
    device?: {
      browser?: string;
      os?: string;
      deviceType?: string;
    };
  }
): Promise<{
  visitorId: Id<"visitors">;
  sessionId: string;
}> {
  return await callInternalMutation("testData:seedVisitor", {
    workspaceId,
    ...options,
  });
}

/**
 * Creates a deterministic inbox conversation fixture for E2E tests.
 */
export async function createInboxConversationFixture(
  workspaceId: Id<"workspaces">,
  options?: {
    visitorEmail?: string;
    visitorName?: string;
    status?: "open" | "closed" | "snoozed";
    initialMessages?: Array<{
      content: string;
      senderType?: InboxSenderType;
      senderId?: string;
    }>;
  }
): Promise<{
  visitorId: Id<"visitors">;
  visitorSessionToken: string;
  conversationId: Id<"conversations">;
  messageIds: Id<"messages">[];
}> {
  const suffix = Math.random().toString(36).slice(2, 8);
  const visitorEmail =
    options?.visitorEmail ?? `e2e_test_inbox_${Date.now()}_${suffix}@${E2E_TEST_EMAIL_DOMAIN}`;
  const visitorName = options?.visitorName ?? `E2E Inbox Visitor ${suffix}`;

  const visitor = await callInternalMutation<{
    visitorId: Id<"visitors">;
    sessionId: string;
  }>("testing/helpers:createTestVisitor", {
    workspaceId,
    email: visitorEmail,
    name: visitorName,
  });
  const session = await callInternalMutation<{
    sessionToken: string;
  }>("testing/helpers:createTestSessionToken", {
    visitorId: visitor.visitorId,
    workspaceId,
  });

  const conversation = await callInternalMutation<{
    conversationId: Id<"conversations">;
  }>("testing/helpers:createTestConversation", {
    workspaceId,
    visitorId: visitor.visitorId,
    status: options?.status ?? "open",
  });

  const messageIds: Id<"messages">[] = [];
  const initialMessages = options?.initialMessages ?? [];
  for (const message of initialMessages) {
    const senderType = message.senderType ?? "visitor";
    const senderId =
      message.senderId ??
      (senderType === "visitor"
        ? visitor.visitorId
        : `e2e_test_agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

    const result = await callInternalMutation<{
      messageId: Id<"messages">;
    }>("testing/helpers:sendTestMessageDirect", {
      conversationId: conversation.conversationId,
      senderType,
      senderId,
      content: message.content,
    });
    messageIds.push(result.messageId);
  }

  return {
    visitorId: visitor.visitorId,
    visitorSessionToken: session.sessionToken,
    conversationId: conversation.conversationId,
    messageIds,
  };
}

/**
 * Creates an inbox conversation fixture without a linked visitor.
 * Useful for testing admin/system-created threads and no-visitor UI states.
 */
export async function createInboxConversationWithoutVisitorFixture(
  workspaceId: Id<"workspaces">,
  options?: {
    status?: "open" | "closed" | "snoozed";
    initialMessages?: Array<{
      content: string;
      senderType?: InboxSenderType;
      senderId?: string;
    }>;
  }
): Promise<{
  conversationId: Id<"conversations">;
  messageIds: Id<"messages">[];
}> {
  const conversation = await callInternalMutation<{
    conversationId: Id<"conversations">;
  }>("testing/helpers:createTestConversation", {
    workspaceId,
    status: options?.status ?? "open",
  });

  const messageIds: Id<"messages">[] = [];
  const initialMessages = options?.initialMessages ?? [];
  for (const message of initialMessages) {
    const senderType = message.senderType ?? "bot";
    const senderId =
      message.senderId ??
      `e2e_test_sender_${senderType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const result = await callInternalMutation<{
      messageId: Id<"messages">;
    }>("testing/helpers:sendTestMessageDirect", {
      conversationId: conversation.conversationId,
      senderType,
      senderId,
      content: message.content,
    });
    messageIds.push(result.messageId);
  }

  return {
    conversationId: conversation.conversationId,
    messageIds,
  };
}

/**
 * Creates a conversation for an existing visitor.
 */
export async function createConversationForVisitor(
  workspaceId: Id<"workspaces">,
  visitorId: Id<"visitors">,
  options?: {
    status?: "open" | "closed" | "snoozed";
    initialMessage?: string;
  }
): Promise<{
  conversationId: Id<"conversations">;
  messageId?: Id<"messages">;
}> {
  const conversation = await callInternalMutation<{
    conversationId: Id<"conversations">;
  }>("testing/helpers:createTestConversation", {
    workspaceId,
    visitorId,
    status: options?.status ?? "open",
  });

  let messageId: Id<"messages"> | undefined;
  if (options?.initialMessage) {
    const message = await callInternalMutation<{
      messageId: Id<"messages">;
    }>("testing/helpers:sendTestMessageDirect", {
      conversationId: conversation.conversationId,
      senderType: "visitor",
      senderId: visitorId,
      content: options.initialMessage,
    });
    messageId = message.messageId;
  }

  return { conversationId: conversation.conversationId, messageId };
}

/**
 * Creates a ticket for an existing visitor.
 */
export async function createTicketForVisitor(
  workspaceId: Id<"workspaces">,
  visitorId: Id<"visitors">,
  options?: {
    subject?: string;
    description?: string;
    status?: "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
    priority?: "low" | "normal" | "high" | "urgent";
    conversationId?: Id<"conversations">;
  }
): Promise<{ ticketId: Id<"tickets"> }> {
  return await callInternalMutation("testing/helpers:createTestTicket", {
    workspaceId,
    visitorId,
    conversationId: options?.conversationId,
    subject: options?.subject ?? `E2E Visitor Ticket ${Date.now()}`,
    description: options?.description ?? "Seeded ticket for visitors workspace E2E coverage.",
    status: options?.status ?? "submitted",
    priority: options?.priority ?? "normal",
  });
}

/**
 * Sends a message directly in an inbox conversation fixture.
 */
export async function sendInboxFixtureMessage(
  conversationId: Id<"conversations">,
  options: {
    content: string;
    senderType?: InboxSenderType;
    senderId?: string;
  }
): Promise<{
  messageId: Id<"messages">;
}> {
  const senderType = options.senderType ?? "visitor";
  return await callInternalMutation("testing/helpers:sendTestMessageDirect", {
    conversationId,
    senderType,
    senderId:
      options.senderId ??
      `e2e_test_sender_${senderType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    content: options.content,
  });
}

/**
 * Updates inbox conversation status directly for deterministic E2E setup.
 */
export async function setInboxConversationStatus(
  conversationId: Id<"conversations">,
  status: "open" | "closed" | "snoozed"
): Promise<void> {
  await callInternalMutation("testing/helpers:updateTestConversationStatus", {
    id: conversationId,
    status,
  });
}

/**
 * Toggles inbox sidecar suggestions feature for a workspace.
 */
export async function setInboxSuggestionsEnabled(
  workspaceId: Id<"workspaces">,
  enabled: boolean
): Promise<void> {
  await callInternalMutation("testing/helpers:updateTestAISettings", {
    workspaceId,
    suggestionsEnabled: enabled,
  });
}

/**
 * Upserts automation settings for deterministic E2E scenarios.
 */
export async function upsertAutomationSettings(
  workspaceId: Id<"workspaces">,
  options: {
    suggestArticlesEnabled?: boolean;
    showReplyTimeEnabled?: boolean;
    collectEmailEnabled?: boolean;
    askForRatingEnabled?: boolean;
  }
): Promise<void> {
  await callInternalMutation("testing/helpers:upsertTestAutomationSettings", {
    workspaceId,
    ...options,
  });
}

/**
 * Updates custom permissions for a workspace member identified by email.
 * Passing an empty permissions array clears custom permissions.
 */
export async function updateWorkspaceMemberPermissions(
  workspaceId: Id<"workspaces">,
  userEmail: string,
  permissions: string[]
): Promise<void> {
  await callInternalMutation("testing/helpers:updateTestMemberPermissions", {
    workspaceId,
    userEmail,
    permissions,
  });
}

/**
 * Updates workspace help center access policy for policy-boundary E2E checks.
 */
export async function updateHelpCenterAccessPolicy(
  workspaceId: Id<"workspaces">,
  policy: "public" | "restricted"
): Promise<void> {
  await callInternalMutation("testing/helpers:updateTestHelpCenterAccessPolicy", {
    workspaceId,
    policy,
  });
}

/**
 * Completes a tooltip authoring session deterministically for visual picker E2E flows.
 */
export async function completeTooltipAuthoringSession(
  workspaceId: Id<"workspaces">,
  token: string,
  elementSelector: string
): Promise<void> {
  await callInternalMutation("testing/helpers:completeTooltipAuthoringSession", {
    workspaceId,
    token,
    elementSelector,
  });
}

export async function validateTooltipAuthoringToken(
  workspaceId: Id<"workspaces">,
  token: string
): Promise<{ valid: boolean; reason?: string }> {
  return callPublicQuery("tooltipAuthoringSessions:validate", {
    workspaceId,
    token,
  });
}

/**
 * Seeds a deterministic AI response for an inbox conversation.
 */
export async function seedInboxAIResponse(
  conversationId: Id<"conversations">,
  options: {
    visitorId: Id<"visitors">;
    visitorSessionToken: string;
    query: string;
    response: string;
    confidence?: number;
    handedOff?: boolean;
    handoffReason?: string;
    feedback?: "helpful" | "not_helpful";
    sources?: Array<{
      type: string;
      id: string;
      title: string;
    }>;
  }
): Promise<{
  responseId: Id<"aiResponses">;
  messageId: Id<"messages">;
}> {
  const messageId = await callInternalMutation<Id<"messages">>(
    "testing/helpers:sendTestMessageDirect",
    {
      conversationId,
      senderId: "ai-agent",
      senderType: "bot",
      content: options.response,
    }
  );

  const responseId = await callPublicMutation<Id<"aiResponses">>("aiAgent:storeResponse", {
    conversationId,
    visitorId: options.visitorId,
    sessionToken: options.visitorSessionToken,
    messageId,
    query: options.query,
    response: options.response,
    sources: options.sources ?? [],
    confidence: options.confidence ?? 0.75,
    handedOff: options.handedOff ?? false,
    handoffReason: options.handoffReason,
    generationTimeMs: 100,
    tokensUsed: 90,
    model: "openai/gpt-5-nano",
    provider: "openai",
  });

  if (options.feedback) {
    await callPublicMutation<void>("aiAgent:submitFeedback", {
      responseId,
      feedback: options.feedback,
      visitorId: options.visitorId,
      sessionToken: options.visitorSessionToken,
    });
  }

  return { responseId, messageId };
}

/**
 * Seeds a test segment.
 */
export async function seedSegment(
  workspaceId: Id<"workspaces">,
  options?: {
    name?: string;
    audienceRules?: Record<string, unknown>;
  }
): Promise<{
  segmentId: Id<"segments">;
  name: string;
}> {
  return await callInternalMutation("testData:seedSegment", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds messenger settings for a workspace.
 */
export async function seedMessengerSettings(
  workspaceId: Id<"workspaces">,
  options?: {
    primaryColor?: string;
    welcomeMessage?: string;
    launcherPosition?: "right" | "left";
  }
): Promise<{
  settingsId: Id<"messengerSettings">;
}> {
  return await callInternalMutation("testData:seedMessengerSettings", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds AI agent settings for a workspace.
 */
export async function seedAIAgentSettings(
  workspaceId: Id<"workspaces">,
  options?: {
    enabled?: boolean;
  }
): Promise<{
  settingsId: Id<"aiAgentSettings">;
}> {
  return await callInternalMutation("testData:seedAIAgentSettings", {
    workspaceId,
    ...options,
  });
}

/**
 * Seeds comprehensive demo data for screenshot automation.
 * Creates realistic data across all major features.
 */
export async function seedDemoData(workspaceId: Id<"workspaces">): Promise<Record<string, number>> {
  return await callInternalMutation("testData:seedDemoData", { workspaceId });
}

/**
 * Seeds all test data at once for a complete E2E test setup.
 */
export async function seedAllTestData(workspaceId: Id<"workspaces">): Promise<{
  visitorId: Id<"visitors">;
  visitorSessionId: string;
  tourId: Id<"tours">;
  surveyId: Id<"surveys">;
  collectionId: Id<"collections">;
  articleId: Id<"articles">;
  segmentId: Id<"segments">;
}> {
  return await callInternalMutation("testData:seedAll", { workspaceId });
}

/**
 * Cleans up all test data with e2e_test_ prefix from a workspace.
 */
export async function cleanupTestData(workspaceId: Id<"workspaces">): Promise<{
  success: boolean;
  cleaned: {
    tours: number;
    tourSteps: number;
    tourProgress: number;
    surveys: number;
    surveyResponses: number;
    surveyImpressions: number;
    carousels: number;
    carouselImpressions: number;
    outboundMessages: number;
    outboundMessageImpressions: number;
    articles: number;
    collections: number;
    segments: number;
    visitors: number;
  };
}> {
  return await callInternalMutation("testData:cleanupTestData", { workspaceId });
}

/**
 * Cleans up all E2E test data across all workspaces.
 */
export async function cleanupAllTestData(): Promise<{
  success: boolean;
  totalCleaned: {
    workspaces: number;
    items: number;
  };
}> {
  return await callInternalMutation("testData:cleanupAll", {});
}

/**
 * Cleans up E2E test data including users with @test.opencom.dev emails.
 */
export async function cleanupE2ETestData(): Promise<{
  success: boolean;
  deleted: {
    users: number;
    workspaces: number;
    conversations: number;
    messages: number;
    visitors: number;
    members: number;
    invitations: number;
  };
}> {
  return await callInternalMutation("testing/helpers:cleanupE2ETestData", {});
}

/**
 * Test data fixture for a complete E2E test setup.
 * Use this in beforeAll/beforeEach to set up test data.
 */
/**
 * Clears all tours for a workspace. Used for testing empty state.
 */
export async function clearAllTours(workspaceId: Id<"workspaces">): Promise<{
  success: boolean;
  deletedCount: number;
}> {
  return await callInternalMutation("testData:clearAllTours", { workspaceId });
}

/**
 * Gets the count of tours for a workspace.
 */
export async function getTourCount(workspaceId: Id<"workspaces">): Promise<{
  count: number;
}> {
  return await callInternalMutation("testData:getTourCount", { workspaceId });
}

export class TestDataFixture {
  workspaceId: Id<"workspaces"> | null = null;
  userId: Id<"users"> | null = null;
  workspaceName: string | null = null;

  async setup(workspaceName?: string): Promise<void> {
    const result = await createTestWorkspace(workspaceName);
    this.workspaceId = result.workspaceId;
    this.userId = result.userId;
    this.workspaceName = result.name;
  }

  async teardown(): Promise<void> {
    if (this.workspaceId) {
      try {
        await cleanupTestData(this.workspaceId);
      } catch (e) {
        console.warn("Test data cleanup failed:", e);
      }
    }
  }

  getWorkspaceId(): Id<"workspaces"> {
    if (!this.workspaceId) {
      throw new Error("Test fixture not set up. Call setup() first.");
    }
    return this.workspaceId;
  }

  getUserId(): Id<"users"> {
    if (!this.userId) {
      throw new Error("Test fixture not set up. Call setup() first.");
    }
    return this.userId;
  }
}
