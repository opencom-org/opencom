/**
 * Custom Playwright Reporter that logs test results
 *
 * Add to playwright.config.ts:
 *   reporter: [
 *     ['list'],
 *     ['./e2e/helpers/test-run-reporter.js']
 *   ],
 */

const fs = require("fs");
const path = require("path");
const { logTestRun } = require("./test-logger");

class TestRunReporter {
  constructor() {
    this.currentTestFile = "";
    this.rootSuite = null;
  }

  onBegin(_config, suite) {
    this.rootSuite = suite;
  }

  onTestBegin(test) {
    this.currentTestFile = test.location.file.split("/").pop() || "";
  }

  onTestEnd(test, result) {
    const testName = test.title;
    const status = result.status;
    const duration = result.duration;
    const error = result.error?.message || result.error?.value;

    logTestRun(this.currentTestFile, testName, status, duration, error);
  }

  onEnd(result) {
    if (!this.rootSuite) return;

    const outcomes = {
      expected: 0,
      unexpected: 0,
      flaky: 0,
      skipped: 0,
    };

    for (const test of this.rootSuite.allTests()) {
      const outcome = test.outcome();
      if (Object.prototype.hasOwnProperty.call(outcomes, outcome)) {
        outcomes[outcome] += 1;
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      status: result.status,
      outcomes,
    };

    const summaryPath = process.env.E2E_SUMMARY_PATH;
    if (summaryPath) {
      fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    }

    console.log(
      `[e2e-gate] outcomes expected=${outcomes.expected} unexpected=${outcomes.unexpected} flaky=${outcomes.flaky} skipped=${outcomes.skipped}`
    );
  }
}

module.exports = TestRunReporter;
