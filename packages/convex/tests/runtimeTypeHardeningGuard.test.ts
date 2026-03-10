import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TARGET_FILES = [
  "../convex/events.ts",
  "../convex/series/runtime.ts",
  "../convex/series/scheduler.ts",
  "../convex/lib/authWrappers.ts",
  "../convex/tickets.ts",
  "../convex/suggestions.ts",
];

describe("runtime type hardening guards", () => {
  it("prevents broad any-casts in covered runtime-critical modules", () => {
    for (const relativePath of TARGET_FILES) {
      const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
      expect(source).not.toMatch(/\bas any\b/);
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
    expect(seriesRuntimeSource).not.toContain("(internal as any).series");
    expect(seriesSchedulerSource).not.toContain("(internal as any).series");
    expect(eventsSource).toContain("scheduleSeriesEvaluateEnrollment");
    expect(eventsSource).toContain("scheduleSeriesResumeWaitingForEvent");
    expect(seriesSchedulerSource).toContain("scheduleSeriesProcessProgress");
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
    expect(functionRefsSource).toContain("dispatchPushAttemptsRef");
    expect(functionRefsSource).toContain("sendNotificationEmailRef");

    expect(chatEmitterSource).toContain("getMemberRecipientsForNewVisitorMessageRef");
    expect(chatEmitterSource).toContain("getVisitorRecipientsForSupportReplyRef");
    expect(dispatchSource).toContain("logDeliveryOutcomeRef");
    expect(dispatchSource).toContain("sendPushRef");
  });
});
