import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    alias: {
      "react-native": "./tests/__mocks__/react-native.ts",
      "@react-native-async-storage/async-storage": "./tests/__mocks__/async-storage.ts",
    },
  },
});
