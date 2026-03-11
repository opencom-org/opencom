import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(TESTS_DIR, "../src");

const INTERNAL_CONVEX_PATH = resolve(SRC_DIR, "internal/convex.ts");
const INTERNAL_RUNTIME_PATH = resolve(SRC_DIR, "internal/runtime.ts");
const INTERNAL_OPENCOM_CONTEXT_PATH = resolve(SRC_DIR, "internal/opencomContext.ts");

const TRANSPORT_BOUNDARY_FILES = [
  "hooks/useConversations.ts",
  "hooks/useTickets.ts",
  "hooks/useArticles.ts",
  "hooks/useMessengerSettings.ts",
  "hooks/useAutomationSettings.ts",
  "hooks/useOfficeHours.ts",
  "hooks/useChecklists.ts",
  "hooks/useOutboundMessages.ts",
  "hooks/useAIAgent.ts",
  "hooks/useArticleSuggestions.ts",
  "hooks/useSurveyDelivery.ts",
  "components/messenger/useConversationDetailController.ts",
  "components/OpencomTicketCreate.tsx",
  "components/OpencomHome.tsx",
  "components/OpencomCarousel.tsx",
  "components/survey/useSurveyController.ts",
  "push/index.ts",
].map((relativePath) => resolve(SRC_DIR, relativePath));

describe("react native sdk hook boundary guards", () => {
  it("centralizes Convex hook access in the internal adapter", () => {
    const source = readFileSync(INTERNAL_CONVEX_PATH, "utf8");

    expect(source).toContain('from "convex/react"');
    expect(source).toContain("makeFunctionReference(");
    expect(source).toContain("export function sdkQueryRef");
    expect(source).toContain("export function sdkMutationRef");
    expect(source).toContain("export function sdkActionRef");
    expect(source).toContain("export function useSdkQuery");
    expect(source).toContain("export function useSdkMutation");
    expect(source).toContain("export function useSdkAction");
  });

  it("centralizes visitor/session/workspace resolution in the internal runtime helper", () => {
    const runtimeSource = readFileSync(INTERNAL_RUNTIME_PATH, "utf8");
    const opencomContextSource = readFileSync(INTERNAL_OPENCOM_CONTEXT_PATH, "utf8");

    expect(runtimeSource).toContain("export function getSdkTransportContext");
    expect(runtimeSource).toContain("export function getSdkVisitorTransport");
    expect(runtimeSource).toContain("export function hasVisitorSessionTransport");
    expect(runtimeSource).toContain("export function hasVisitorWorkspaceTransport");

    expect(opencomContextSource).toContain("export function useSdkTransportContext");
    expect(opencomContextSource).toContain("export function useSdkResolvedWorkspaceId");
  });

  it("keeps covered public hooks and components off direct Convex transport factories", () => {
    for (const filePath of TRANSPORT_BOUNDARY_FILES) {
      const source = readFileSync(filePath, "utf8");

      expect(source).not.toContain('from "convex/react"');
      expect(source).not.toContain("makeFunctionReference(");
      expect(source).not.toContain("function getQueryRef(name: string)");
      expect(source).not.toContain("function getMutationRef(name: string)");
      expect(source).not.toContain("function getActionRef(name: string)");
    }
  });

  it("keeps OpencomHome and push flows on the shared internal boundaries", () => {
    const homeSource = readFileSync(resolve(SRC_DIR, "components/OpencomHome.tsx"), "utf8");
    const pushSource = readFileSync(resolve(SRC_DIR, "push/index.ts"), "utf8");

    expect(homeSource).toContain("useConversations()");
    expect(homeSource).toContain("useArticles()");
    expect(homeSource).toContain("useArticleSearch(searchQuery)");
    expect(homeSource).toContain("useHomeConfig(workspaceId, isIdentified)");

    expect(pushSource).toContain("sdkMutationRef(");
    expect(pushSource).toContain("getSdkTransportContext()");
    expect(pushSource).toContain("getSdkVisitorTransport()");
  });
});
