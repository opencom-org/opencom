import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("hosted onboarding", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    client = new ConvexClient(convexUrl);
    const auth = await authenticateClientForWorkspace(client);
    workspaceId = auth.workspaceId;
  });

  afterAll(async () => {
    await client.close();
  });

  it("starts onboarding and issues a verification token", async () => {
    const started = await client.mutation(api.workspaces.startHostedOnboarding, {
      workspaceId,
    });

    expect(started.status).toBe("in_progress");
    expect(started.currentStep).toBe(0);

    const issued = await client.mutation(api.workspaces.issueHostedOnboardingVerificationToken, {
      workspaceId,
    });

    expect(issued.token.startsWith("onb_")).toBe(true);
    expect(typeof issued.issuedAt).toBe("number");

    const state = await client.query(api.workspaces.getHostedOnboardingState, {
      workspaceId,
    });

    expect(state.status).toBe("in_progress");
    expect(state.verificationToken).toBe(issued.token);
  });

  it("rejects verification events with a mismatched token", async () => {
    const issued = await client.mutation(api.workspaces.issueHostedOnboardingVerificationToken, {
      workspaceId,
    });

    const result = await client.mutation(api.workspaces.recordHostedOnboardingVerificationEvent, {
      workspaceId,
      token: `${issued.token}_invalid`,
      origin: "https://example.com",
      currentUrl: "https://example.com/demo",
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("token_mismatch");
  });

  it("completes the widget step after a valid verification event", async () => {
    const issued = await client.mutation(api.workspaces.issueHostedOnboardingVerificationToken, {
      workspaceId,
    });

    const verification = await client.mutation(
      api.workspaces.recordHostedOnboardingVerificationEvent,
      {
        workspaceId,
        token: issued.token,
        origin: "https://example.com",
        currentUrl: "https://example.com/demo",
      }
    );

    expect(verification.accepted).toBe(true);

    const completed = await client.mutation(api.workspaces.completeHostedOnboardingWidgetStep, {
      workspaceId,
      token: issued.token,
    });

    expect(completed.success).toBe(true);
    if (!completed.success) {
      throw new Error(`Expected completion success but got ${completed.reason}`);
    }

    const state = await client.query(api.workspaces.getHostedOnboardingState, {
      workspaceId,
    });

    expect(state.status).toBe("completed");
    expect(state.completedSteps).toContain("widget_install");
    expect(state.isWidgetVerified).toBe(true);
  });

  it("supports passive install detection without issuing a verification token", async () => {
    await client.mutation(api.workspaces.startHostedOnboarding, {
      workspaceId,
    });

    await client.mutation(api.widgetSessions.boot, {
      workspaceId,
      sessionId: `sess_${Date.now()}`,
      origin: "https://app.example.com",
      currentUrl: "https://app.example.com/home",
      clientType: "web_widget",
      clientVersion: "test-build-1",
      clientIdentifier: "integration-test",
    });

    const state = await client.query(api.workspaces.getHostedOnboardingState, {
      workspaceId,
    });

    expect(state.isWidgetVerified).toBe(true);
    expect(state.hasRecognizedInstall).toBe(true);
    expect(state.detectedIntegrationCount).toBeGreaterThan(0);

    const signals = await client.query(api.workspaces.getHostedOnboardingIntegrationSignals, {
      workspaceId,
    });

    expect(signals).not.toBeNull();
    expect(signals?.integrations.length ?? 0).toBeGreaterThan(0);
    expect(signals?.integrations[0]?.clientType).toBe("web_widget");
    expect(signals?.integrations[0]?.clientVersion).toBe("test-build-1");

    const completed = await client.mutation(api.workspaces.completeHostedOnboardingWidgetStep, {
      workspaceId,
    });

    expect(completed.success).toBe(true);
  });
});
