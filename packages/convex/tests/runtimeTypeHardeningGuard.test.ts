import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TARGET_FILES = [
  "../convex/aiAgent.ts",
  "../convex/articles.ts",
  "../convex/conversations.ts",
  "../convex/embeddings.ts",
  "../convex/emailChannel.ts",
  "../convex/events.ts",
  "../convex/http.ts",
  "../convex/push.ts",
  "../convex/pushCampaigns.ts",
  "../convex/series/runtime.ts",
  "../convex/series/scheduler.ts",
  "../convex/lib/authWrappers.ts",
  "../convex/internalArticles.ts",
  "../convex/snippets.ts",
  "../convex/supportAttachments.ts",
  "../convex/testing/helpers/notifications.ts",
  "../convex/tickets.ts",
  "../convex/suggestions.ts",
  "../convex/workspaceMembers.ts",
];

const CONVEX_ROOT = new URL("../convex/", import.meta.url);

function collectTypeScriptFiles(dirUrl: URL): URL[] {
  const files: URL[] = [];

  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(entryUrl));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryUrl);
    }
  }

  return files;
}

function toConvexRelativePath(fileUrl: URL): string {
  return fileUrl.pathname.slice(CONVEX_ROOT.pathname.length);
}

describe("runtime type hardening guards", () => {
  it("prevents broad any-casts in covered runtime-critical modules", () => {
    for (const relativePath of TARGET_FILES) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source).not.toMatch(/\bas any\b/);
    }
  });

  it("keeps broad anyApi object casts limited to approved infrastructure files", () => {
    const offenders = collectTypeScriptFiles(CONVEX_ROOT)
      .map((fileUrl) => ({
        relativePath: toConvexRelativePath(fileUrl),
        source: readFileSync(fileUrl, "utf8"),
      }))
      .filter(
        ({ source }) =>
          source.includes("anyApi as unknown as") ||
          source.includes("(anyApi as unknown as") ||
          source.includes("const unsafeApi") ||
          source.includes("const unsafeInternal")
      )
      .map(({ relativePath }) => relativePath)
      .sort();

    expect(offenders).toEqual(["lib/authWrappers.ts"]);
  });

  it("keeps covered backend hotspot runner casts behind named helpers", () => {
    const hotspotFiles = [
      "../convex/aiAgentActions.ts",
      "../convex/outboundMessages.ts",
      "../convex/carousels/triggering.ts",
      "../convex/widgetSessions.ts",
      "../convex/push.ts",
    ];

    for (const relativePath of hotspotFiles) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source).not.toContain("const runQuery = ctx.runQuery as unknown as");
      expect(source).not.toContain("const runMutation = ctx.runMutation as unknown as");
      expect(source).not.toContain("const runAction = ctx.runAction as unknown as");
    }
  });

  it("routes series runtime internal calls through typed adapters", () => {
    const eventsSource = readFileSync(new URL("../convex/events.ts", import.meta.url), "utf8");
    const seriesRuntimeSource = readFileSync(
      new URL("../convex/series/runtime.ts", import.meta.url),
      "utf8"
    );
    const seriesSchedulerSource = readFileSync(
      new URL("../convex/series/scheduler.ts", import.meta.url),
      "utf8"
    );

    expect(eventsSource).not.toContain("(internal as any).series");
    expect(eventsSource).not.toContain("function getInternalRef(name: string)");
    expect(seriesRuntimeSource).not.toContain("(internal as any).series");
    expect(seriesSchedulerSource).not.toContain("(internal as any).series");
    expect(seriesSchedulerSource).not.toContain("function getInternalRef(name: string)");
    expect(eventsSource).toContain("scheduleSeriesEvaluateEnrollment");
    expect(eventsSource).toContain("scheduleSeriesResumeWaitingForEvent");
    expect(eventsSource).toContain("CHECK_AUTO_COMPLETION_REF");
    expect(seriesSchedulerSource).toContain("scheduleSeriesProcessProgress");
    expect(seriesSchedulerSource).toContain("EVALUATE_ENROLLMENT_FOR_VISITOR_REF");
    expect(seriesSchedulerSource).toContain("RESUME_WAITING_FOR_EVENT_REF");
    expect(seriesSchedulerSource).toContain("PROCESS_PROGRESS_REF");
    expect(seriesSchedulerSource).toContain("EVALUATE_ENTRY_REF");
    expect(seriesSchedulerSource).toContain("PROCESS_WAITING_PROGRESS_REF");
    expect(seriesRuntimeSource).toContain("runSeriesEvaluateEntry");
  });

  it("uses fixed typed notification refs for ticket scheduling", () => {
    const ticketsSource = readFileSync(new URL("../convex/tickets.ts", import.meta.url), "utf8");

    expect(ticketsSource).not.toContain("function getInternalRef(name: string)");
    expect(ticketsSource).toContain("NOTIFY_TICKET_CREATED_REF");
    expect(ticketsSource).toContain("scheduleTicketCreatedNotification");
    expect(ticketsSource).toContain("scheduleTicketResolvedNotification");
  });

  it("uses fixed typed refs for suggestion cross-function calls", () => {
    const suggestionsSource = readFileSync(new URL("../convex/suggestions.ts", import.meta.url), "utf8");

    expect(suggestionsSource).not.toContain("function getApiRef(name: string)");
    expect(suggestionsSource).toContain("GET_EMBEDDING_BY_ID_REF");
    expect(suggestionsSource).toContain("SEARCH_SIMILAR_INTERNAL_REF");
    expect(suggestionsSource).toContain("VALIDATE_SESSION_TOKEN_REF");
  });

  it("uses fixed typed refs for support attachment cleanup scheduling", () => {
    const supportAttachmentsSource = readFileSync(
      new URL("../convex/supportAttachments.ts", import.meta.url),
      "utf8"
    );

    expect(supportAttachmentsSource).not.toContain("function getInternalRef(name: string)");
    expect(supportAttachmentsSource).not.toContain("makeFunctionReference(");
    expect(supportAttachmentsSource).not.toContain("as unknown as");
    expect(supportAttachmentsSource).toContain("CLEANUP_EXPIRED_STAGED_UPLOADS_REF");
    expect(supportAttachmentsSource).toContain('from "./supportAttachmentFunctionRefs"');
    expect(supportAttachmentsSource).toContain('from "./notifications/functionRefs"');
  });

  it("uses fixed typed refs for HTTP origin validation", () => {
    const httpSource = readFileSync(new URL("../convex/http.ts", import.meta.url), "utf8");

    expect(httpSource).not.toContain("function getApiRef(name: string)");
    expect(httpSource).toContain("VALIDATE_ORIGIN_REF");
    expect(httpSource).toContain("GET_METADATA_REF");
    expect(httpSource).toContain("GET_EMAIL_CONFIG_BY_FORWARDING_ADDRESS_REF");
    expect(httpSource).toContain("PROCESS_FORWARDED_EMAIL_REF");
    expect(httpSource).toContain("PROCESS_INBOUND_EMAIL_REF");
    expect(httpSource).toContain("UPDATE_DELIVERY_STATUS_BY_EXTERNAL_ID_REF");
    expect(httpSource).toContain("getShallowRunQuery");
    expect(httpSource).toContain("getShallowRunMutation");
  });

  it("uses shared notification refs and fixed email delivery refs for email channel flows", () => {
    const emailChannelSource = readFileSync(
      new URL("../convex/emailChannel.ts", import.meta.url),
      "utf8"
    );

    expect(emailChannelSource).not.toContain("function getInternalRef(name: string)");
    expect(emailChannelSource).toContain('from "./notifications/functionRefs"');
    expect(emailChannelSource).toContain("notifyNewMessageRef");
    expect(emailChannelSource).toContain("notifyNewConversationRef");
    expect(emailChannelSource).toContain("SEND_EMAIL_VIA_PROVIDER_REF");
    expect(emailChannelSource).toContain("UPDATE_DELIVERY_STATUS_REF");
    expect(emailChannelSource).toContain("getShallowRunAfter");
    expect(emailChannelSource).toContain("getShallowRunMutation");
  });

  it("uses fixed typed refs for embedding self-dispatch and permission checks", () => {
    const embeddingsSource = readFileSync(new URL("../convex/embeddings.ts", import.meta.url), "utf8");

    expect(embeddingsSource).not.toContain("function getInternalRef(name: string)");
    expect(embeddingsSource).toContain("GET_BY_CONTENT_REF");
    expect(embeddingsSource).toContain("UPDATE_EMBEDDING_REF");
    expect(embeddingsSource).toContain("INSERT_EMBEDDING_REF");
    expect(embeddingsSource).toContain("GENERATE_INTERNAL_REF");
    expect(embeddingsSource).toContain("REQUIRE_PERMISSION_FOR_ACTION_REF");
    expect(embeddingsSource).toContain("LIST_ARTICLES_REF");
    expect(embeddingsSource).toContain("LIST_INTERNAL_ARTICLES_REF");
    expect(embeddingsSource).toContain("LIST_SNIPPETS_REF");
    expect(embeddingsSource).toContain("GENERATE_BATCH_INTERNAL_REF");
    expect(embeddingsSource).toContain("getShallowRunQuery");
    expect(embeddingsSource).toContain("getShallowRunMutation");
    expect(embeddingsSource).toContain("getShallowRunAction");
  });

  it("uses fixed typed refs for push delivery boundaries", () => {
    const pushSource = readFileSync(new URL("../convex/push.ts", import.meta.url), "utf8");
    const pushFunctionRefsSource = readFileSync(
      new URL("../convex/push/functionRefs.ts", import.meta.url),
      "utf8"
    );

    expect(pushSource).not.toContain("function getInternalRef(name: string)");
    expect(pushSource).toContain('from "./push/functionRefs"');
    expect(pushFunctionRefsSource).toContain("SEND_PUSH_REF");
    expect(pushFunctionRefsSource).toContain("GET_TOKENS_FOR_VISITORS_REF");
    expect(pushFunctionRefsSource).toContain("GET_TOKENS_FOR_WORKSPACE_REF");
    expect(pushFunctionRefsSource).toContain("GET_TOKENS_FOR_VISITOR_REF");
    expect(pushFunctionRefsSource).toContain("GET_CONVERSATION_REF");
    expect(pushFunctionRefsSource).toContain("GET_ELIGIBLE_VISITORS_REF");
    expect(pushFunctionRefsSource).toContain("RECORD_PUSH_TOKEN_DELIVERY_FAILURE_REF");
    expect(pushFunctionRefsSource).toContain("RECORD_VISITOR_PUSH_TOKEN_DELIVERY_FAILURE_REF");
    expect(pushFunctionRefsSource).toContain("getShallowRunQuery");
    expect(pushFunctionRefsSource).toContain("getShallowRunAction");
    expect(pushFunctionRefsSource).toContain("getShallowRunMutation");
  });

  it("uses fixed typed refs for push campaign delivery orchestration", () => {
    const pushCampaignsSource = readFileSync(
      new URL("../convex/pushCampaigns.ts", import.meta.url),
      "utf8"
    );

    expect(pushCampaignsSource).not.toContain("function getInternalRef(name: string)");
    expect(pushCampaignsSource).toContain('from "./notifications/functionRefs"');
    expect(pushCampaignsSource).toContain("GET_INTERNAL_REF");
    expect(pushCampaignsSource).toContain("GET_PENDING_RECIPIENTS_REF");
    expect(pushCampaignsSource).toContain("UPDATE_RECIPIENT_STATUS_REF");
    expect(pushCampaignsSource).toContain("UPDATE_STATS_REF");
    expect(pushCampaignsSource).toContain("dispatchPushAttemptsRef");
    expect(pushCampaignsSource).toContain("getShallowRunQuery");
    expect(pushCampaignsSource).toContain("getShallowRunAction");
    expect(pushCampaignsSource).toContain("getShallowRunMutation");
  });

  it("uses shared notification refs for message scheduling", () => {
    const messagesSource = readFileSync(new URL("../convex/messages.ts", import.meta.url), "utf8");

    expect(messagesSource).not.toContain("function getInternalRef(name: string)");
    expect(messagesSource).toContain('from "./notifications/functionRefs"');
    expect(messagesSource).toContain("notifyNewMessageRef");
    expect(messagesSource).toContain("getShallowRunAfter");
  });

  it("uses shared notification refs for conversation scheduling", () => {
    const conversationsSource = readFileSync(
      new URL("../convex/conversations.ts", import.meta.url),
      "utf8"
    );

    expect(conversationsSource).not.toContain("function getInternalRef(name: string)");
    expect(conversationsSource).toContain('from "./notifications/functionRefs"');
    expect(conversationsSource).toContain("notifyNewConversationRef");
    expect(conversationsSource).toContain("notifyAssignmentRef");
    expect(conversationsSource).toContain("getShallowRunAfter");
  });

  it("uses shared notification refs for AI handoff scheduling", () => {
    const aiAgentSource = readFileSync(new URL("../convex/aiAgent.ts", import.meta.url), "utf8");

    expect(aiAgentSource).not.toContain("function getInternalRef(name: string)");
    expect(aiAgentSource).toContain('from "./notifications/functionRefs"');
    expect(aiAgentSource).toContain("routeEventRef");
    expect(aiAgentSource).toContain("getShallowRunAfter");
  });

  it("uses shared embedding refs for article scheduling", () => {
    const articlesSource = readFileSync(new URL("../convex/articles.ts", import.meta.url), "utf8");

    expect(articlesSource).not.toContain("function getInternalRef(name: string)");
    expect(articlesSource).toContain('from "./embeddings/functionRefs"');
    expect(articlesSource).toContain("generateInternalEmbeddingRef");
    expect(articlesSource).toContain("removeEmbeddingRef");
    expect(articlesSource).toContain("getShallowRunAfter");
  });

  it("uses shared embedding refs for internal article scheduling", () => {
    const internalArticlesSource = readFileSync(
      new URL("../convex/internalArticles.ts", import.meta.url),
      "utf8"
    );

    expect(internalArticlesSource).not.toContain("function getInternalRef(name: string)");
    expect(internalArticlesSource).toContain('from "./embeddings/functionRefs"');
    expect(internalArticlesSource).toContain("generateInternalEmbeddingRef");
    expect(internalArticlesSource).toContain("removeEmbeddingRef");
    expect(internalArticlesSource).toContain("getShallowRunAfter");
  });

  it("uses fixed typed refs for snippet embedding scheduling", () => {
    const snippetsSource = readFileSync(new URL("../convex/snippets.ts", import.meta.url), "utf8");

    expect(snippetsSource).not.toContain("function getInternalRef(name: string)");
    expect(snippetsSource).toContain("GENERATE_SNIPPET_EMBEDDINGS_REF");
    expect(snippetsSource).toContain("getShallowRunAfter");
  });

  it("uses fixed typed refs for workspace invitation dispatch", () => {
    const workspaceMembersSource = readFileSync(
      new URL("../convex/workspaceMembers.ts", import.meta.url),
      "utf8"
    );

    expect(workspaceMembersSource).not.toContain("function getInternalRef(name: string)");
    expect(workspaceMembersSource).toContain("CREATE_INVITATION_REF");
    expect(workspaceMembersSource).toContain("getShallowRunMutation");
  });

  it("uses fixed typed refs for visitor identity verification", () => {
    const visitorMutationsSource = readFileSync(
      new URL("../convex/visitors/mutations.ts", import.meta.url),
      "utf8"
    );

    expect(visitorMutationsSource).not.toContain("function getInternalRef(name: string)");
    expect(visitorMutationsSource).toContain("VERIFY_IDENTITY_REF");
    expect(visitorMutationsSource).toContain("getShallowRunMutation");
  });

  it("uses shared fixed refs for notification routing and emitter scheduling", () => {
    const functionRefsSource = readFileSync(
      new URL("../convex/notifications/functionRefs.ts", import.meta.url),
      "utf8"
    );
    const routingSource = readFileSync(
      new URL("../convex/notifications/routing.ts", import.meta.url),
      "utf8"
    );
    const dispatchSource = readFileSync(
      new URL("../convex/notifications/dispatch.ts", import.meta.url),
      "utf8"
    );
    const chatEmitterSource = readFileSync(
      new URL("../convex/notifications/emitters/chat.ts", import.meta.url),
      "utf8"
    );
    const ticketEmitterSource = readFileSync(
      new URL("../convex/notifications/emitters/ticket.ts", import.meta.url),
      "utf8"
    );

    expect(routingSource).not.toContain("function getInternalRef(name: string)");
    expect(dispatchSource).not.toContain("function getInternalRef(name: string)");
    expect(chatEmitterSource).not.toContain("function getInternalRef(name: string)");
    expect(ticketEmitterSource).not.toContain("function getInternalRef(name: string)");

    expect(functionRefsSource).toContain("routeEventRef");
    expect(functionRefsSource).toContain("notifyNewMessageRef");
    expect(functionRefsSource).toContain("notifyNewConversationRef");
    expect(functionRefsSource).toContain("notifyAssignmentRef");
    expect(functionRefsSource).toContain("dispatchPushAttemptsRef");
    expect(functionRefsSource).toContain("sendNotificationEmailRef");

    expect(chatEmitterSource).toContain("getMemberRecipientsForNewVisitorMessageRef");
    expect(chatEmitterSource).toContain("getVisitorRecipientsForSupportReplyRef");
    expect(dispatchSource).toContain("logDeliveryOutcomeRef");
    expect(dispatchSource).toContain("sendPushRef");
  });

  it("uses fixed typed refs in notification test helpers", () => {
    const helperSource = readFileSync(
      new URL("../convex/testing/helpers/notifications.ts", import.meta.url),
      "utf8"
    );

    expect(helperSource).not.toContain("function getInternalRef(name: string)");
    expect(helperSource).toContain("SEND_FOR_TESTING_REF");
    expect(helperSource).toContain("GET_PENDING_RECIPIENTS_REF");
    expect(helperSource).toContain("GET_MEMBER_RECIPIENTS_FOR_NEW_VISITOR_MESSAGE_REF");
    expect(helperSource).toContain("GET_VISITOR_RECIPIENTS_FOR_SUPPORT_REPLY_REF");
    expect(helperSource).toContain("getShallowRunMutation");
    expect(helperSource).toContain("getShallowRunQuery");
  });

  it("uses shared fixed refs for embedding scheduling", () => {
    const functionRefsSource = readFileSync(
      new URL("../convex/embeddings/functionRefs.ts", import.meta.url),
      "utf8"
    );

    expect(functionRefsSource).toContain("generateInternalEmbeddingRef");
    expect(functionRefsSource).toContain("removeEmbeddingRef");
    expect(functionRefsSource).toContain("getShallowRunAfter");
  });

  it("keeps the dynamic test admin gateway scoped to test-only modules", () => {
    const testAdminSource = readFileSync(new URL("../convex/testAdmin.ts", import.meta.url), "utf8");

    expect(testAdminSource).toContain('const ALLOWED_MODULE_PREFIXES = ["testData", "testing"]');
    expect(testAdminSource).toContain("if (!ALLOWED_MODULE_PREFIXES.includes(topModule))");
    expect(testAdminSource).toContain("return await runMutation(getInternalRef(name),");
    expect(testAdminSource).not.toContain('"notifications"');
    expect(testAdminSource).not.toContain('"messages"');
  });
});
