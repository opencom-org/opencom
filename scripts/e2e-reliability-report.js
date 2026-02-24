#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const summaryPath = process.env.E2E_SUMMARY_PATH
  ? path.resolve(process.cwd(), process.env.E2E_SUMMARY_PATH)
  : path.resolve(process.cwd(), "artifacts/e2e-summary.json");

const logPath = process.env.E2E_TEST_LOG_PATH
  ? path.resolve(process.cwd(), process.env.E2E_TEST_LOG_PATH)
  : path.resolve(process.cwd(), "test-run-log.jsonl");

const outputPath = process.env.E2E_RELIABILITY_REPORT_PATH
  ? path.resolve(process.cwd(), process.env.E2E_RELIABILITY_REPORT_PATH)
  : path.resolve(process.cwd(), "artifacts/e2e-reliability-report.json");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

function topReasons(entries, limit) {
  const counts = new Map();
  for (const entry of entries) {
    const reason = (entry.error || "unknown").split("\n")[0].slice(0, 240);
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function classifyFailureSignature(errorMessage) {
  const message = String(errorMessage || "").toLowerCase();
  if (!message) {
    return "unknown";
  }

  if (message.includes("permission denied") || message.includes("permission_denied")) {
    return "permission_denied";
  }

  if (
    message.includes("auth-refresh") ||
    message.includes("redirect") ||
    message.includes("/login") ||
    message.includes("could not authenticate")
  ) {
    return "auth_redirect";
  }

  if (
    message.includes("application error") ||
    message.includes("runtime error") ||
    message.includes("runtime overlay")
  ) {
    return "runtime_overlay";
  }

  return "unknown";
}

function signatureBreakdown(entries) {
  const buckets = {
    permission_denied: 0,
    auth_redirect: 0,
    runtime_overlay: 0,
    unknown: 0,
  };

  for (const entry of entries) {
    const bucket = classifyFailureSignature(entry.error);
    buckets[bucket] += 1;
  }

  return buckets;
}

const summary = readJson(summaryPath, {
  timestamp: new Date().toISOString(),
  status: "unknown",
  outcomes: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
});

const entries = readJsonl(logPath);

const report = {
  generatedAt: new Date().toISOString(),
  source: {
    summaryPath,
    logPath,
  },
  outcomes: {
    expected: Number(summary.outcomes?.expected || 0),
    unexpected: Number(summary.outcomes?.unexpected || 0),
    flaky: Number(summary.outcomes?.flaky || 0),
    skipped: Number(summary.outcomes?.skipped || 0),
    did_not_run: summary.status === "timedout" || summary.status === "interrupted" ? 1 : 0,
  },
  status: summary.status || "unknown",
  reasonBreakdown: {
    failed: topReasons(
      entries.filter((entry) => entry.status === "failed"),
      20
    ),
    skipped: topReasons(
      entries.filter((entry) => entry.status === "skipped"),
      20
    ),
    timedOut: topReasons(
      entries.filter((entry) => entry.status === "timedOut"),
      20
    ),
  },
  failureSignatures: signatureBreakdown(
    entries.filter((entry) => entry.status === "failed" || entry.status === "timedOut")
  ),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log(`[e2e-report] wrote reliability report to ${outputPath}`);
console.log(
  `[e2e-report] outcomes expected=${report.outcomes.expected} unexpected=${report.outcomes.unexpected} flaky=${report.outcomes.flaky} skipped=${report.outcomes.skipped}`
);
