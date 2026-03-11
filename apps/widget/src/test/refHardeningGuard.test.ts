import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WIDGET_SRC_DIR = resolve(TEST_DIR, "..");

const HELPER_PATH = resolve(TEST_DIR, "convexFunctionRefs.ts");
const ADAPTER_PATH = resolve(TEST_DIR, "../lib/convex/hooks.ts");
const MAIN_PATH = resolve(TEST_DIR, "../main.tsx");
const CONVERSATION_WRAPPER_PATH = resolve(
  TEST_DIR,
  "../hooks/convex/useConversationViewConvex.ts"
);
const TOUR_WRAPPER_PATH = resolve(TEST_DIR, "../hooks/convex/useTourProgressConvex.ts");
const APPROVED_TEST_BOUNDARY_FILES = [
  resolve(TEST_DIR, "useWidgetSession.test.tsx"),
  resolve(TEST_DIR, "widgetNewConversation.test.tsx"),
  resolve(TEST_DIR, "widgetShellOrchestration.test.tsx"),
  resolve(TEST_DIR, "widgetTicketErrorFeedback.test.tsx"),
  resolve(TEST_DIR, "widgetTourBridgeLifecycle.test.tsx"),
  resolve(TEST_DIR, "widgetTourStart.test.tsx"),
  resolve(TEST_DIR, "outboundOverlay.test.tsx"),
  resolve(TEST_DIR, "tourOverlay.test.tsx"),
  resolve(TEST_DIR, "../components/ConversationView.test.tsx"),
];
const APPROVED_DIRECT_CONVEX_BOUNDARY_FILES = [
  ADAPTER_PATH,
  MAIN_PATH,
  ...APPROVED_TEST_BOUNDARY_FILES,
];

const DIRECT_CONVEX_IMPORT_PATTERN = /from "convex\/react"/;
const DIRECT_REF_FACTORY_PATTERN = /\bmakeFunctionReference(?:\s*<[\s\S]*?>)?\s*\(/;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    if (!entry.isFile()) {
      return [];
    }

    const extension = extname(entry.name);
    return extension === ".ts" || extension === ".tsx" ? [entryPath] : [];
  });
}

function isApprovedDirectConvexBoundary(filePath: string): boolean {
  return APPROVED_DIRECT_CONVEX_BOUNDARY_FILES.includes(filePath);
}

function findUnexpectedWidgetDirectConvexBoundaries(): string[] {
  return collectSourceFiles(WIDGET_SRC_DIR).flatMap((filePath) => {
    if (isApprovedDirectConvexBoundary(filePath)) {
      return [];
    }

    const source = readFileSync(filePath, "utf8");
    const violations: string[] = [];

    if (DIRECT_CONVEX_IMPORT_PATTERN.test(source)) {
      violations.push(`${relative(WIDGET_SRC_DIR, filePath)}: direct convex/react import`);
    }

    if (DIRECT_REF_FACTORY_PATTERN.test(source)) {
      violations.push(`${relative(WIDGET_SRC_DIR, filePath)}: direct makeFunctionReference call`);
    }

    return violations;
  });
}

describe("widget ref hardening guards", () => {
  it("flags direct makeFunctionReference calls with or without generic arguments", () => {
    const bareCallSource = 'const ref = ' + 'makeFunctionReference' + '("foo:bar");';
    const genericCallSource =
      "const ref = " +
      "makeFunctionReference" +
      '<"query", { nested: FunctionReference<"query"> }, Result>("foo:bar");';

    expect(DIRECT_REF_FACTORY_PATTERN.test(bareCallSource)).toBe(true);
    expect(
      DIRECT_REF_FACTORY_PATTERN.test(genericCallSource)
    ).toBe(true);
  });

  it("uses Convex supported function-name extraction in the shared helper", () => {
    const source = readFileSync(HELPER_PATH, "utf8");

    expect(source).toContain("getFunctionName(");
    expect(source).toContain("matchesFunctionPath");
  });

  it("keeps migrated session/conversation tests on the shared helper", () => {
    for (const filePath of APPROVED_TEST_BOUNDARY_FILES) {
      const source = readFileSync(filePath, "utf8");

      if (filePath.endsWith("ConversationView.test.tsx")) {
        expect(source).toContain("matchesFunctionPath");
        expect(source).not.toMatch(/\bfunction getFunctionPath\(/);
      }
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
    expect(source).toContain("function toWidgetQueryArgs");
    expect(source).toContain("OptionalRestArgsOrSkip");
    expect(source).not.toContain("as never");
    expect(source).not.toContain("as unknown as");
    expect(source.match(/as OptionalRestArgsOrSkip/g)).toHaveLength(1);
  });

  it("keeps widget runtime modules on widget-local Convex wrappers", () => {
    const conversationWrapperSource = readFileSync(CONVERSATION_WRAPPER_PATH, "utf8");
    const tourWrapperSource = readFileSync(TOUR_WRAPPER_PATH, "utf8");

    expect(conversationWrapperSource).toContain("useWidgetQuery");
    expect(conversationWrapperSource).toContain("useWidgetMutation");
    expect(conversationWrapperSource).toContain("useWidgetAction");
    expect(tourWrapperSource).toContain("useWidgetMutation");
    expect(findUnexpectedWidgetDirectConvexBoundaries()).toEqual([]);
  });

  it("keeps the approved direct Convex boundaries explicit", () => {
    expect(
      APPROVED_DIRECT_CONVEX_BOUNDARY_FILES.map((filePath) => relative(WIDGET_SRC_DIR, filePath))
    ).toEqual([
      "lib/convex/hooks.ts",
      "main.tsx",
      "test/useWidgetSession.test.tsx",
      "test/widgetNewConversation.test.tsx",
      "test/widgetShellOrchestration.test.tsx",
      "test/widgetTicketErrorFeedback.test.tsx",
      "test/widgetTourBridgeLifecycle.test.tsx",
      "test/widgetTourStart.test.tsx",
      "test/outboundOverlay.test.tsx",
      "test/tourOverlay.test.tsx",
      "components/ConversationView.test.tsx",
    ]);
  });
});
