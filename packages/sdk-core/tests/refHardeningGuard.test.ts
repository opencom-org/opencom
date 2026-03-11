import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(TEST_DIR, "../src/api");

const COVERED_WRAPPER_FILES = [
  resolve(API_DIR, "aiAgent.ts"),
  resolve(API_DIR, "articles.ts"),
  resolve(API_DIR, "carousels.ts"),
  resolve(API_DIR, "checklists.ts"),
  resolve(API_DIR, "commonIssues.ts"),
  resolve(API_DIR, "conversations.ts"),
  resolve(API_DIR, "events.ts"),
  resolve(API_DIR, "officeHours.ts"),
  resolve(API_DIR, "outbound.ts"),
  resolve(API_DIR, "sessions.ts"),
  resolve(API_DIR, "tickets.ts"),
  resolve(API_DIR, "visitors.ts"),
];

const GENERIC_QUERY_FACTORY_PATTERN = /\bfunction getQueryRef\(name: string\)/;
const GENERIC_MUTATION_FACTORY_PATTERN = /\bfunction getMutationRef\(name: string\)/;
const DYNAMIC_REF_FACTORY_PATTERN = /\bmakeFunctionReference\(\s*name\s*\)/;
const FIXED_REF_DECLARATION_PATTERN =
  /\bconst [A-Z0-9_]+_REF\s*=\s*makeFunctionReference\("[^"]+"\)\s*as FunctionReference<"(?:query|mutation)">;/g;

describe("sdk-core ref hardening guards", () => {
  it("freezes the March 11 2026 covered wrapper inventory", () => {
    expect(COVERED_WRAPPER_FILES.map((filePath) => basename(filePath))).toEqual([
      "aiAgent.ts",
      "articles.ts",
      "carousels.ts",
      "checklists.ts",
      "commonIssues.ts",
      "conversations.ts",
      "events.ts",
      "officeHours.ts",
      "outbound.ts",
      "sessions.ts",
      "tickets.ts",
      "visitors.ts",
    ]);
  });

  it("keeps covered wrappers on explicit fixed Convex refs", () => {
    for (const filePath of COVERED_WRAPPER_FILES) {
      const source = readFileSync(filePath, "utf8");

      expect(source).not.toMatch(GENERIC_QUERY_FACTORY_PATTERN);
      expect(source).not.toMatch(GENERIC_MUTATION_FACTORY_PATTERN);
      expect(source).not.toMatch(DYNAMIC_REF_FACTORY_PATTERN);
      expect(source.match(FIXED_REF_DECLARATION_PATTERN)?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
