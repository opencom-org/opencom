#!/usr/bin/env node

/**
 * CLI command to view test failure summary
 *
 * Usage:
 *   pnpm test:summary     - Show last 10 runs
 *   pnpm test:summary 20  - Show last 20 runs
 *   pnpm test:clear       - Clear the log
 */

const path = require("path");
const { showFailureSummary, clearTestLog } = require(
  path.join(__dirname, "..", "apps", "web", "e2e", "helpers", "test-logger")
);

const args = process.argv.slice(2);
const command = args[0];

if (command === "clear") {
  clearTestLog();
  console.log("✅ Test log cleared");
} else {
  const runs = parseInt(command) || 10;
  showFailureSummary(runs);
}
