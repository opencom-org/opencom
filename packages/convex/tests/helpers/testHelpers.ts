import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";

const MISSING_PUBLIC_FUNCTION_TEXT = "Could not find public function";

async function callInternalTestMutation<T>(
  name: string,
  mutationArgs: Record<string, unknown>
): Promise<T> {
  const convexUrl = process.env.CONVEX_URL;
  const secret = process.env.TEST_ADMIN_SECRET;
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }
  if (!secret) {
    throw new Error(
      `TEST_ADMIN_SECRET is required to call internal test helper "${name}" via testAdmin gateway`
    );
  }

  const response = await fetch(`${convexUrl}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "testAdmin:runTestMutation",
      args: { secret, name, mutationArgs },
      format: "json",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Internal test mutation ${name} failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as
    | { status: "success"; value: T }
    | { status: "error"; errorMessage: string };
  if (json.status === "success") {
    return json.value;
  }
  throw new Error(`Internal test mutation ${name} error: ${json.errorMessage}`);
}

async function withInternalFallback<T>(
  name: string,
  publicCall: () => Promise<T>,
  mutationArgs: Record<string, unknown>
): Promise<T> {
  try {
    return await publicCall();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(MISSING_PUBLIC_FUNCTION_TEXT)) {
      throw error;
    }
    return callInternalTestMutation<T>(name, mutationArgs);
  }
}

export async function createTestWorkspace(
  client: ConvexClient,
  name?: string
): Promise<{
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  name: string;
}> {
  const args = name ? { name } : {};
  return withInternalFallback(
    "testing/helpers:createTestWorkspace",
    () => client.mutation(api.testing.helpers.createTestWorkspace, args),
    args
  );
}

export type SeriesEntryTriggerTestContext = {
  source: "event" | "auto_event" | "visitor_attribute_changed" | "visitor_state_changed";
  eventName?: string;
  attributeKey?: string;
  fromValue?: string;
  toValue?: string;
};

export async function runSeriesEvaluateEnrollmentForVisitor(args: {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  triggerContext: SeriesEntryTriggerTestContext;
}): Promise<{ evaluated: number; entered: number; reason?: string }> {
  return callInternalTestMutation<{ evaluated: number; entered: number; reason?: string }>(
    "testing/helpers:runSeriesEvaluateEnrollmentForVisitor",
    args
  );
}

export async function runSeriesResumeWaitingForEvent(args: {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  eventName: string;
}): Promise<{ matched: number; resumed: number; reason?: string }> {
  return callInternalTestMutation<{ matched: number; resumed: number; reason?: string }>(
    "testing/helpers:runSeriesResumeWaitingForEvent",
    args
  );
}

export async function runSeriesProcessWaitingProgress(args?: {
  seriesLimit?: number;
  waitingLimitPerSeries?: number;
}): Promise<{ processed: number; scanned?: number; reason?: string }> {
  return callInternalTestMutation<{ processed: number; scanned?: number; reason?: string }>(
    "testing/helpers:runSeriesProcessWaitingProgress",
    args ?? {}
  );
}

export async function getSeriesProgressForVisitorSeries(args: {
  visitorId: Id<"visitors">;
  seriesId: Id<"series">;
}): Promise<Doc<"seriesProgress"> | null> {
  return callInternalTestMutation<Doc<"seriesProgress"> | null>(
    "testing/helpers:getSeriesProgressForVisitorSeries",
    args
  );
}

export async function updateSeriesProgressForTest(args: {
  progressId: Id<"seriesProgress">;
  status?: "active" | "waiting" | "completed" | "exited" | "goal_reached" | "failed";
  waitUntil?: number;
  waitEventName?: string;
  attemptCount?: number;
  lastExecutionError?: string;
  clearWaitUntil?: boolean;
  clearWaitEventName?: boolean;
}): Promise<Doc<"seriesProgress"> | null> {
  return callInternalTestMutation<Doc<"seriesProgress"> | null>(
    "testing/helpers:updateSeriesProgressForTest",
    args
  );
}

export async function createTestUser(args: {
  workspaceId: Id<"workspaces">;
  email?: string;
  name?: string;
  role?: "admin" | "agent";
}): Promise<{ userId: Id<"users">; email: string; name: string }> {
  return callInternalTestMutation<{
    userId: Id<"users">;
    email: string;
    name: string;
  }>("testing/helpers:createTestUser", args);
}

export async function addTestWorkspaceMember(args: {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  role: "owner" | "admin" | "agent" | "viewer";
}): Promise<Id<"workspaceMembers">> {
  return callInternalTestMutation<Id<"workspaceMembers">>(
    "testing/helpers:addTestWorkspaceMember",
    args
  );
}

export async function createTestAuditLog(args: {
  workspaceId: Id<"workspaces">;
  action: string;
  actorType?: "user" | "system" | "api";
  actorId?: Id<"users">;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}): Promise<{ logId: Id<"auditLogs">; timestamp: number }> {
  return callInternalTestMutation<{ logId: Id<"auditLogs">; timestamp: number }>(
    "testing/helpers:createTestAuditLog",
    args
  );
}

export async function createTestVisitor(
  client: ConvexClient,
  args: {
    workspaceId: Id<"workspaces">;
    email?: string;
    name?: string;
    externalUserId?: string;
    customAttributes?: Record<string, unknown>;
  }
): Promise<{ visitorId: Id<"visitors"> }> {
  return withInternalFallback(
    "testing/helpers:createTestVisitor",
    () => client.mutation(api.testing.helpers.createTestVisitor, args),
    args
  );
}

export async function createTestSessionToken(
  client: ConvexClient,
  args: {
    visitorId: Id<"visitors">;
    workspaceId: Id<"workspaces">;
  }
): Promise<{ sessionToken: string }> {
  return withInternalFallback(
    "testing/helpers:createTestSessionToken",
    () => client.mutation(api.testing.helpers.createTestSessionToken, args),
    args
  );
}

export async function createTestConversation(
  client: ConvexClient,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    status?: "open" | "closed" | "snoozed";
    assignedAgentId?: Id<"users">;
    firstResponseAt?: number;
    resolvedAt?: number;
  }
): Promise<{ conversationId: Id<"conversations"> }> {
  return withInternalFallback(
    "testing/helpers:createTestConversation",
    () => client.mutation(api.testing.helpers.createTestConversation, args),
    args
  );
}

export async function upsertTestAutomationSettings(
  client: ConvexClient,
  args: {
    workspaceId: Id<"workspaces">;
    suggestArticlesEnabled?: boolean;
    showReplyTimeEnabled?: boolean;
    collectEmailEnabled?: boolean;
    askForRatingEnabled?: boolean;
  }
): Promise<Id<"automationSettings">> {
  return withInternalFallback(
    "testing/helpers:upsertTestAutomationSettings",
    () => client.mutation(api.testing.helpers.upsertTestAutomationSettings, args),
    args
  );
}

export async function createTestSeries(
  client: ConvexClient,
  args: {
    workspaceId: Id<"workspaces">;
    status?: "draft" | "active" | "paused" | "archived";
  }
): Promise<{ seriesId: Id<"series"> }> {
  return withInternalFallback(
    "testing/helpers:createTestSeries",
    () => client.mutation(api.testing.helpers.createTestSeries, args),
    args
  );
}

export async function createTestSurvey(
  client: ConvexClient,
  args: {
    workspaceId: Id<"workspaces">;
    status?: "draft" | "active" | "paused" | "archived";
  }
): Promise<{ surveyId: Id<"surveys"> }> {
  return withInternalFallback(
    "testing/helpers:createTestSurvey",
    () => client.mutation(api.testing.helpers.createTestSurvey, args),
    args
  );
}

export async function expireTooltipAuthoringSession(
  client: ConvexClient,
  args: {
    token: string;
    workspaceId: Id<"workspaces">;
  }
): Promise<void> {
  await withInternalFallback(
    "testing/helpers:expireTooltipAuthoringSession",
    () => client.mutation(api.testing.helpers.expireTooltipAuthoringSession, args),
    args
  );
}

export async function createTestPushCampaign(
  client: ConvexClient,
  args: {
    workspaceId: Id<"workspaces">;
    status?: "draft" | "scheduled" | "sending" | "sent" | "paused";
  }
): Promise<{ campaignId: Id<"pushCampaigns"> }> {
  return withInternalFallback(
    "testing/helpers:createTestPushCampaign",
    () => client.mutation(api.testing.helpers.createTestPushCampaign, args),
    args
  );
}

export async function cleanupTestData(
  client: ConvexClient,
  args: { workspaceId: Id<"workspaces"> }
): Promise<void> {
  await withInternalFallback(
    "testing/helpers:cleanupTestData",
    () => client.mutation(api.testing.helpers.cleanupTestData, args),
    args
  );
}

export async function updateTestMemberPermissions(
  client: ConvexClient,
  args: {
    workspaceId: Id<"workspaces">;
    userEmail: string;
    permissions: string[];
  }
): Promise<void> {
  await withInternalFallback(
    "testing/helpers:updateTestMemberPermissions",
    () => client.mutation(api.testing.helpers.updateTestMemberPermissions, args),
    args
  );
}
