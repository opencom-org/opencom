import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["apps/mobile/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/_generated/**"],
  },
});
