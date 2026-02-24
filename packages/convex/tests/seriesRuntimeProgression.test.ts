import { describe, it, expect } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";
import {
  cleanupTestData,
  createTestVisitor,
  getSeriesProgressForVisitorSeries,
  runSeriesEvaluateEnrollmentForVisitor,
  runSeriesProcessWaitingProgress,
  runSeriesResumeWaitingForEvent,
  updateSeriesProgressForTest,
} from "./helpers/testHelpers";

type TestWorkspaceContext = {
  client: ConvexClient;
  workspaceId: Id<"workspaces">;
};

function requireConvexUrl(): string {
  const convexUrl = process.env.CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }
  return convexUrl;
}

function uniqueSuffix(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function withIsolatedWorkspace(
  run: (context: TestWorkspaceContext) => Promise<void>
): Promise<void> {
  const client = new ConvexClient(requireConvexUrl());
  const auth = await authenticateClientForWorkspace(client);

  try {
    await run({ client, workspaceId: auth.workspaceId });
  } finally {
    try {
      await cleanupTestData(client, { workspaceId: auth.workspaceId });
    } catch (error) {
      console.warn("Cleanup failed:", error);
    }
    await client.close();
  }
}

describe("series runtime progression", () => {
  it("enrolls only visitors matching trigger and entry rules", async () => {
    await withIsolatedWorkspace(async ({ client, workspaceId }) => {
      const entryEventName = uniqueSuffix("entry-event");
      const otherEventName = uniqueSuffix("other-event");

      const seriesId = await client.mutation(api.series.create, {
        workspaceId,
        name: uniqueSuffix("enrollment-series"),
        entryTriggers: [{ source: "event", eventName: entryEventName }],
        entryRules: {
          type: "condition",
          property: { source: "custom", key: "plan" },
          operator: "equals",
          value: "pro",
        },
      });

      await client.mutation(api.series.addBlock, {
        seriesId,
        type: "wait",
        position: { x: 0, y: 0 },
        config: {
          waitType: "duration",
          waitDuration: 5,
          waitUnit: "minutes",
        },
      });

      await client.mutation(api.series.activate, { id: seriesId });

      const proVisitor = await createTestVisitor(client, {
        workspaceId,
        customAttributes: { plan: "pro" },
      });
      const freeVisitor = await createTestVisitor(client, {
        workspaceId,
        customAttributes: { plan: "free" },
      });
      const wrongEventVisitor = await createTestVisitor(client, {
        workspaceId,
        customAttributes: { plan: "pro" },
      });

      const proEval = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: proVisitor.visitorId,
        triggerContext: { source: "event", eventName: entryEventName },
      });
      expect(proEval.evaluated).toBe(1);
      expect(proEval.entered).toBe(1);

      const freeEval = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: freeVisitor.visitorId,
        triggerContext: { source: "event", eventName: entryEventName },
      });
      expect(freeEval.evaluated).toBe(1);
      expect(freeEval.entered).toBe(0);

      const wrongTriggerEval = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: wrongEventVisitor.visitorId,
        triggerContext: { source: "event", eventName: otherEventName },
      });
      expect(wrongTriggerEval.evaluated).toBe(1);
      expect(wrongTriggerEval.entered).toBe(0);

      const proProgress = await getSeriesProgressForVisitorSeries({
        visitorId: proVisitor.visitorId,
        seriesId,
      });
      const freeProgress = await getSeriesProgressForVisitorSeries({
        visitorId: freeVisitor.visitorId,
        seriesId,
      });
      const wrongTriggerProgress = await getSeriesProgressForVisitorSeries({
        visitorId: wrongEventVisitor.visitorId,
        seriesId,
      });

      expect(proProgress?.status).toBe("waiting");
      expect(freeProgress).toBeNull();
      expect(wrongTriggerProgress).toBeNull();
    });
  });

  it("resumes event waits only when matching event arrives", async () => {
    await withIsolatedWorkspace(async ({ client, workspaceId }) => {
      const entryEventName = uniqueSuffix("entry-event");
      const waitEventName = uniqueSuffix("resume-event");

      const seriesId = await client.mutation(api.series.create, {
        workspaceId,
        name: uniqueSuffix("event-wait-series"),
        entryTriggers: [{ source: "event", eventName: entryEventName }],
      });

      const waitBlockId = await client.mutation(api.series.addBlock, {
        seriesId,
        type: "wait",
        position: { x: 0, y: 0 },
        config: {
          waitType: "until_event",
          waitUntilEvent: waitEventName,
        },
      });

      const chatBlockId = await client.mutation(api.series.addBlock, {
        seriesId,
        type: "chat",
        position: { x: 220, y: 0 },
        config: {
          body: "Thanks for completing that step.",
        },
      });

      await client.mutation(api.series.addConnection, {
        seriesId,
        fromBlockId: waitBlockId,
        toBlockId: chatBlockId,
        condition: "default",
      });

      await client.mutation(api.series.activate, { id: seriesId });

      const visitor = await createTestVisitor(client, { workspaceId });

      const evalResult = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: visitor.visitorId,
        triggerContext: { source: "event", eventName: entryEventName },
      });
      expect(evalResult.entered).toBe(1);

      const waitingProgress = await getSeriesProgressForVisitorSeries({
        visitorId: visitor.visitorId,
        seriesId,
      });
      expect(waitingProgress?.status).toBe("waiting");
      expect(waitingProgress?.waitEventName).toBe(waitEventName);

      const wrongResume = await runSeriesResumeWaitingForEvent({
        workspaceId,
        visitorId: visitor.visitorId,
        eventName: uniqueSuffix("wrong-resume-event"),
      });
      expect(wrongResume.matched).toBe(0);
      expect(wrongResume.resumed).toBe(0);

      const matchingResume = await runSeriesResumeWaitingForEvent({
        workspaceId,
        visitorId: visitor.visitorId,
        eventName: waitEventName,
      });
      expect(matchingResume.matched).toBe(1);
      expect(matchingResume.resumed).toBe(1);

      const completedProgress = await getSeriesProgressForVisitorSeries({
        visitorId: visitor.visitorId,
        seriesId,
      });
      expect(completedProgress?.status).toBe("completed");
      expect(completedProgress?.waitEventName).toBeUndefined();
    });
  });

  it("resumes overdue duration waits via backstop processing", async () => {
    await withIsolatedWorkspace(async ({ client, workspaceId }) => {
      const entryEventName = uniqueSuffix("entry-event");

      const seriesId = await client.mutation(api.series.create, {
        workspaceId,
        name: uniqueSuffix("duration-wait-series"),
        entryTriggers: [{ source: "event", eventName: entryEventName }],
      });

      const waitBlockId = await client.mutation(api.series.addBlock, {
        seriesId,
        type: "wait",
        position: { x: 0, y: 0 },
        config: {
          waitType: "duration",
          waitDuration: 10,
          waitUnit: "minutes",
        },
      });

      const chatBlockId = await client.mutation(api.series.addBlock, {
        seriesId,
        type: "chat",
        position: { x: 220, y: 0 },
        config: {
          body: "Backstop resumed this wait.",
        },
      });

      await client.mutation(api.series.addConnection, {
        seriesId,
        fromBlockId: waitBlockId,
        toBlockId: chatBlockId,
        condition: "default",
      });

      await client.mutation(api.series.activate, { id: seriesId });

      const visitor = await createTestVisitor(client, { workspaceId });

      const evalResult = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: visitor.visitorId,
        triggerContext: { source: "event", eventName: entryEventName },
      });
      expect(evalResult.entered).toBe(1);

      const waitingProgress = await getSeriesProgressForVisitorSeries({
        visitorId: visitor.visitorId,
        seriesId,
      });
      expect(waitingProgress?.status).toBe("waiting");

      await updateSeriesProgressForTest({
        progressId: waitingProgress!._id,
        waitUntil: Date.now() - 1_000,
      });

      const backstopResult = await runSeriesProcessWaitingProgress({
        seriesLimit: 50,
        waitingLimitPerSeries: 50,
      });
      expect(backstopResult.processed).toBeGreaterThanOrEqual(1);

      const resumedProgress = await getSeriesProgressForVisitorSeries({
        visitorId: visitor.visitorId,
        seriesId,
      });
      expect(resumedProgress?.status).toBe("completed");
    });
  });

  it("retries failed execution and marks progress failed after max attempts", async () => {
    await withIsolatedWorkspace(async ({ client, workspaceId }) => {
      const entryEventName = uniqueSuffix("entry-event");

      const seriesId = await client.mutation(api.series.create, {
        workspaceId,
        name: uniqueSuffix("retry-series"),
        entryTriggers: [{ source: "event", eventName: entryEventName }],
      });

      await client.mutation(api.series.addBlock, {
        seriesId,
        type: "email",
        position: { x: 0, y: 0 },
        config: {
          subject: "Welcome",
          body: "Hello from a test series",
        },
      });

      await client.mutation(api.emailChannel.upsertEmailConfig, {
        workspaceId,
        enabled: true,
      });

      await client.mutation(api.series.activate, { id: seriesId });

      const visitorWithoutEmail = await createTestVisitor(client, { workspaceId });

      const evalResult = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: visitorWithoutEmail.visitorId,
        triggerContext: { source: "event", eventName: entryEventName },
      });
      expect(evalResult.entered).toBe(1);

      const firstAttempt = await getSeriesProgressForVisitorSeries({
        visitorId: visitorWithoutEmail.visitorId,
        seriesId,
      });
      expect(firstAttempt?.status).toBe("waiting");
      expect(firstAttempt?.attemptCount).toBe(1);
      expect(firstAttempt?.lastExecutionError).toContain("Visitor email is required");

      await updateSeriesProgressForTest({
        progressId: firstAttempt!._id,
        status: "waiting",
        waitUntil: Date.now() - 1_000,
      });
      await runSeriesProcessWaitingProgress({ seriesLimit: 50, waitingLimitPerSeries: 50 });

      const secondAttempt = await getSeriesProgressForVisitorSeries({
        visitorId: visitorWithoutEmail.visitorId,
        seriesId,
      });
      expect(secondAttempt?.status).toBe("waiting");
      expect(secondAttempt?.attemptCount).toBe(2);

      await updateSeriesProgressForTest({
        progressId: secondAttempt!._id,
        status: "waiting",
        waitUntil: Date.now() - 1_000,
      });
      await runSeriesProcessWaitingProgress({ seriesLimit: 50, waitingLimitPerSeries: 50 });

      const finalAttempt = await getSeriesProgressForVisitorSeries({
        visitorId: visitorWithoutEmail.visitorId,
        seriesId,
      });
      expect(finalAttempt?.status).toBe("failed");
      expect(finalAttempt?.attemptCount).toBe(3);
      expect(finalAttempt?.failedAt).toBeDefined();
      expect(finalAttempt?.waitUntil).toBeUndefined();
    });
  });

  it("prioritizes exit transitions over goal transitions when both match", async () => {
    await withIsolatedWorkspace(async ({ client, workspaceId }) => {
      const entryEventName = uniqueSuffix("entry-event");

      const seriesId = await client.mutation(api.series.create, {
        workspaceId,
        name: uniqueSuffix("exit-priority-series"),
        entryTriggers: [{ source: "event", eventName: entryEventName }],
        exitRules: {
          type: "condition",
          property: { source: "custom", key: "state" },
          operator: "equals",
          value: "done",
        },
        goalRules: {
          type: "condition",
          property: { source: "custom", key: "state" },
          operator: "equals",
          value: "done",
        },
      });

      await client.mutation(api.series.addBlock, {
        seriesId,
        type: "chat",
        position: { x: 0, y: 0 },
        config: {
          body: "This should be skipped by terminal transition.",
        },
      });

      await client.mutation(api.series.activate, { id: seriesId });

      const visitor = await createTestVisitor(client, {
        workspaceId,
        customAttributes: { state: "done" },
      });

      const evalResult = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: visitor.visitorId,
        triggerContext: { source: "event", eventName: entryEventName },
      });
      expect(evalResult.entered).toBe(1);

      const progress = await getSeriesProgressForVisitorSeries({
        visitorId: visitor.visitorId,
        seriesId,
      });
      expect(progress?.status).toBe("exited");
      expect(progress?.exitedAt).toBeDefined();
      expect(progress?.goalReachedAt).toBeUndefined();
    });
  });

  it("marks progress as goal_reached when goal matches and exit does not", async () => {
    await withIsolatedWorkspace(async ({ client, workspaceId }) => {
      const entryEventName = uniqueSuffix("entry-event");

      const seriesId = await client.mutation(api.series.create, {
        workspaceId,
        name: uniqueSuffix("goal-series"),
        entryTriggers: [{ source: "event", eventName: entryEventName }],
        exitRules: {
          type: "condition",
          property: { source: "custom", key: "state" },
          operator: "equals",
          value: "closed",
        },
        goalRules: {
          type: "condition",
          property: { source: "custom", key: "purchased" },
          operator: "equals",
          value: true,
        },
      });

      await client.mutation(api.series.addBlock, {
        seriesId,
        type: "chat",
        position: { x: 0, y: 0 },
        config: {
          body: "This should be skipped when goal is reached.",
        },
      });

      await client.mutation(api.series.activate, { id: seriesId });

      const visitor = await createTestVisitor(client, {
        workspaceId,
        customAttributes: { state: "open", purchased: true },
      });

      const evalResult = await runSeriesEvaluateEnrollmentForVisitor({
        workspaceId,
        visitorId: visitor.visitorId,
        triggerContext: { source: "event", eventName: entryEventName },
      });
      expect(evalResult.entered).toBe(1);

      const progress = await getSeriesProgressForVisitorSeries({
        visitorId: visitor.visitorId,
        seriesId,
      });
      expect(progress?.status).toBe("goal_reached");
      expect(progress?.goalReachedAt).toBeDefined();
      expect(progress?.exitedAt).toBeUndefined();
    });
  });
});
