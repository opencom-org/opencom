/**
 * Test Run Logger
 *
 * Simple utility to log test results and track failure patterns over time.
 *
 * Usage:
 *   const { logTestRun, showFailureSummary } = require('./test-logger');
 *
 *   // In your test file or reporter
 *   logTestRun('tours.spec.ts', 'should create tour', 'passed', 5000);
 *   logTestRun('tours.spec.ts', 'should delete tour', 'failed', 10000, 'Timeout error');
 *
 *   // Show summary
 *   showFailureSummary();
 */

const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "..", "..", "..", "test-run-log.jsonl");

/**
 * Log a single test result
 */
function logTestRun(testFile, testName, status, duration, error) {
  const entry = {
    timestamp: new Date().toISOString(),
    testFile,
    testName,
    status,
    duration,
    error,
    runId: process.env.TEST_RUN_ID || `run-${Date.now()}`,
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

/**
 * Read all test run entries
 */
function readTestRuns() {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const content = fs.readFileSync(LOG_FILE, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Show summary of recent failures
 */
function showFailureSummary(runs = 10) {
  const entries = readTestRuns();

  if (entries.length === 0) {
    console.log("\n📊 No test runs logged yet.\n");
    return;
  }

  // Group by test
  const testStats = new Map();

  entries.forEach((entry) => {
    const key = `${entry.testFile}:${entry.testName}`;
    const stats = testStats.get(key) || { passed: 0, failed: 0, lastError: undefined };

    if (entry.status === "passed") {
      stats.passed++;
    } else if (entry.status === "failed") {
      stats.failed++;
      stats.lastError = entry.error;
    }

    testStats.set(key, stats);
  });

  // Show results
  console.log("\n📊 Test Failure Summary (last " + runs + " runs):");
  console.log("===============================================");

  let hasFailures = false;
  testStats.forEach((stats, test) => {
    const total = stats.passed + stats.failed;
    const passRate = total > 0 ? ((stats.passed / total) * 100).toFixed(1) : "0";

    if (stats.failed > 0) {
      hasFailures = true;
      console.log(`\n❌ ${test}`);
      console.log(`   Pass Rate: ${stats.passed}/${total} (${passRate}%)`);
      console.log(`   Last Error: ${stats.lastError || "Unknown"}`);
    }
  });

  if (!hasFailures) {
    console.log("\n✅ All tests passing! No failures recorded.\n");
  }

  console.log("\n===============================================\n");
}

/**
 * Clear the log file
 */
function clearTestLog() {
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
  }
}

module.exports = {
  logTestRun,
  readTestRuns,
  showFailureSummary,
  clearTestLog,
};
