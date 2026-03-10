import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HELPER_PATH = resolve(process.cwd(), "src/test/convexFunctionRefs.ts");
const MIGRATED_TEST_FILES = [
  resolve(process.cwd(), "src/test/useWidgetSession.test.tsx"),
  resolve(process.cwd(), "src/test/widgetNewConversation.test.tsx"),
  resolve(process.cwd(), "src/components/ConversationView.test.tsx"),
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
});
