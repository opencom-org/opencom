import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

const HELPER_PATH = resolve(TEST_DIR, "convexFunctionRefs.ts");
const ADAPTER_PATH = resolve(TEST_DIR, "../lib/convex/hooks.ts");
const CONVERSATION_WRAPPER_PATH = resolve(
  TEST_DIR,
  "../hooks/convex/useConversationViewConvex.ts"
);
const TOUR_WRAPPER_PATH = resolve(TEST_DIR, "../hooks/convex/useTourProgressConvex.ts");
const MIGRATED_TEST_FILES = [
  resolve(TEST_DIR, "useWidgetSession.test.tsx"),
  resolve(TEST_DIR, "widgetNewConversation.test.tsx"),
  resolve(TEST_DIR, "../components/ConversationView.test.tsx"),
];
const MIGRATED_RUNTIME_FILES = [
  resolve(TEST_DIR, "../components/ConversationView.tsx"),
  resolve(TEST_DIR, "../tourOverlay/useTourOverlayActions.ts"),
];

describe("widget ref hardening guards", () => {
  it("uses Convex supported function-name extraction in the shared helper", () => {
    const source = readFileSync(HELPER_PATH, "utf8");

    expect(source).toContain("getFunctionName(");
    expect(source).toContain("matchesFunctionPath");
  });

  it("keeps migrated session/conversation tests on the shared helper", () => {
    for (const filePath of MIGRATED_TEST_FILES) {
      const source = readFileSync(filePath, "utf8");

      expect(source).toContain("matchesFunctionPath");
      expect(source).not.toMatch(/\bfunction getFunctionPath\(/);
    }
  });

  it("provides a widget-local Convex adapter layer for typed wrapper hooks", () => {
    const source = readFileSync(ADAPTER_PATH, "utf8");

    expect(source).toContain("export function widgetQueryRef");
    expect(source).toContain("export function widgetMutationRef");
    expect(source).toContain("export function widgetActionRef");
    expect(source).toContain("export function useWidgetQuery");
    expect(source).toContain("export function useWidgetMutation");
    expect(source).toContain("export function useWidgetAction");
  });

  it("keeps migrated runtime modules on widget-local Convex wrappers", () => {
    const conversationWrapperSource = readFileSync(CONVERSATION_WRAPPER_PATH, "utf8");
    const tourWrapperSource = readFileSync(TOUR_WRAPPER_PATH, "utf8");

    expect(conversationWrapperSource).toContain("useWidgetQuery");
    expect(conversationWrapperSource).toContain("useWidgetMutation");
    expect(conversationWrapperSource).toContain("useWidgetAction");
    expect(tourWrapperSource).toContain("useWidgetMutation");

    for (const filePath of MIGRATED_RUNTIME_FILES) {
      const source = readFileSync(filePath, "utf8");

      expect(source).not.toContain('from "convex/react"');
      expect(source).not.toContain("makeFunctionReference(");
    }
  });
});
