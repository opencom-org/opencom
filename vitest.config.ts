import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(workspaceRoot, "apps/web/src"),
    },
  },
  esbuild: {
    jsxInject: 'import React from "react"',
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["apps/web/src/**/*.test.{ts,tsx}", "apps/widget/src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/_generated/**"],
    setupFiles: ["./apps/web/src/test/setup.ts", "./apps/widget/src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "**/dist/**",
        "**/_generated/**",
        "**/*.test.{ts,tsx}",
        "**/e2e/**",
      ],
    },
    testTimeout: 30000,
    env: {
      CONVEX_URL: "https://wooden-moose-405.eu-west-1.convex.cloud",
    },
  },
});
