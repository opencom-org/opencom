import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "../tests/helpers/authSession";

type TriggerSummary = {
  workspaceId: string;
  conversationId: string;
  attempts: Array<{
    attempt: number;
    responsePreview: string;
    responseLength: number;
    confidence: number;
    handoff: boolean;
    handoffReason: string | null;
    messageId: string | null;
    lastConfigError: unknown;
  }>;
  responseCount: number;
};

async function main() {
  const convexUrl = process.env.CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required");
  }

  const client = new ConvexClient(convexUrl);
  const attemptCount = Math.max(1, Number(process.env.DIAG_ATTEMPTS ?? "1"));
  const query = process.env.DIAG_QUERY ?? "How do I get started?";

  try {
    const auth = await authenticateClientForWorkspace(client);
    const workspaceId = auth.workspaceId;

    const articleId = await client.mutation(api.articles.create, {
      workspaceId,
      title: "Hosted Quick Start",
      content:
        "Sign in, create a workspace, copy the widget snippet from Settings > Widget Installation, and add it to your site.",
    });
    await client.mutation(api.articles.publish, { id: articleId });

    const sessionId = `diag-${Date.now()}`;
    const boot = await client.mutation(api.widgetSessions.boot, {
      workspaceId,
      sessionId,
      origin: "http://localhost:3000",
      currentUrl: "http://localhost:3000/widget",
    });

    const conversation = await client.mutation(api.conversations.createForVisitor, {
      workspaceId,
      visitorId: boot.visitor._id,
      sessionToken: boot.sessionToken,
    });
    const conversationId = typeof conversation === "string" ? conversation : conversation._id;

    await client.mutation(api.aiAgent.updateSettings, {
      workspaceId,
      enabled: true,
      model: "openai/gpt-5-nano",
      confidenceThreshold: 0.6,
      knowledgeSources: ["articles"],
      personality: "Be concise and practical.",
    });

    const attempts: TriggerSummary["attempts"] = [];
    for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
      const result = await client.action(api.aiAgentActions.generateResponse, {
        workspaceId,
        conversationId,
        visitorId: boot.visitor._id,
        sessionToken: boot.sessionToken,
        query,
      });

      const settings = await client.query(api.aiAgent.getSettings, {
        workspaceId,
      });

      const lastConfigError = (settings as { lastConfigError?: unknown }).lastConfigError ?? null;
      attempts.push({
        attempt,
        responsePreview: result.response.slice(0, 220),
        responseLength: result.response.length,
        confidence: result.confidence,
        handoff: result.handoff,
        handoffReason: result.handoffReason,
        messageId: result.messageId,
        lastConfigError,
      });

      const diagnosticCode =
        typeof lastConfigError === "object" &&
        lastConfigError !== null &&
        "code" in lastConfigError &&
        typeof (lastConfigError as { code?: unknown }).code === "string"
          ? (lastConfigError as { code: string }).code
          : null;
      if (diagnosticCode?.startsWith("EMPTY_")) {
        break;
      }
    }

    const responses = await client.query(api.aiAgent.getConversationResponses, {
      conversationId,
      visitorId: boot.visitor._id,
      sessionToken: boot.sessionToken,
    });

    const summary: TriggerSummary = {
      workspaceId,
      conversationId,
      attempts,
      responseCount: responses.length,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("trigger-ai-response-diagnostics failed:", error);
  process.exitCode = 1;
});
