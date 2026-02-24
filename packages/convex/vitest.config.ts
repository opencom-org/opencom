import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.test", quiet: true });

const BASE_EXCLUDE = ["**/node_modules/**", "**/dist/**", "**/_generated/**"];

function collectTestFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function findConvexIntegrationSuites(): string[] {
  return collectTestFiles("tests")
    .filter((file) => readFileSync(file, "utf8").includes("process.env.CONVEX_URL"))
    .map((file) => file.split(sep).join("/"));
}

function findTestAdminSecretSuites(): string[] {
  return collectTestFiles("tests")
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        source.includes("api.testing.helpers.") ||
        source.includes("./helpers/testHelpers") ||
        source.includes("testAdmin:runTestMutation")
      );
    })
    .map((file) => file.split(sep).join("/"));
}

const hasConvexUrl = Boolean(process.env.CONVEX_URL?.trim());
const hasTestAdminSecret = Boolean(process.env.TEST_ADMIN_SECRET?.trim());
const convexIntegrationExcludes = hasConvexUrl ? [] : findConvexIntegrationSuites();
const testAdminSecretExcludes = hasTestAdminSecret ? [] : findTestAdminSecretSuites();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [...BASE_EXCLUDE, ...convexIntegrationExcludes, ...testAdminSecretExcludes],
    setupFiles: ["tests/setupTestAdminFallback.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
