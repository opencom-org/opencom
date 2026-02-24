#!/usr/bin/env node

/**
 * Run E2E tests with production build and show comparison
 *
 * Usage:
 *   node scripts/test-e2e-prod.js [test-pattern]
 *
 * Examples:
 *   node scripts/test-e2e-prod.js
 *   node scripts/test-e2e-prod.js apps/web/e2e/outbound.spec.ts
 */

const { spawn } = require("child_process");
const path = require("path");

const testPattern = process.argv[2] || "";

console.log("🚀 Running E2E tests with production build...");
console.log("⚠️  First run will be slower due to initial build\n");

const startTime = Date.now();

const args = ["exec", "playwright", "test"];
if (testPattern) {
  args.push(testPattern);
}
args.push("--project=chromium");
args.push("--workers=1");

const child = spawn("pnpm", args, {
  stdio: "inherit",
  env: {
    ...process.env,
    E2E_USE_PROD_BUILD: "true",
  },
});

child.on("close", (code) => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Test run completed in ${duration}s`);
  console.log(`Exit code: ${code}`);

  if (code === 0) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log("\n❌ Some tests failed. Run 'pnpm test:summary' to see failure history.");
  }

  process.exit(code);
});
