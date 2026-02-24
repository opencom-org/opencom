#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const budgetPath = process.env.E2E_RELIABILITY_BUDGET_PATH
  ? path.resolve(process.cwd(), process.env.E2E_RELIABILITY_BUDGET_PATH)
  : path.resolve(process.cwd(), "security", "e2e-reliability-budget.json");

const allowlistPath = process.env.E2E_RELIABILITY_ALLOWLIST_PATH
  ? path.resolve(process.cwd(), process.env.E2E_RELIABILITY_ALLOWLIST_PATH)
  : path.resolve(process.cwd(), "security", "e2e-reliability-allowlist.json");

const reportPath = process.env.E2E_RELIABILITY_REPORT_PATH
  ? path.resolve(process.cwd(), process.env.E2E_RELIABILITY_REPORT_PATH)
  : path.resolve(process.cwd(), "artifacts", "e2e-reliability-report.json");

function fail(message) {
  console.error(`[e2e-reliability-gate] ${message}`);
  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found at ${filePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Failed to parse ${label} JSON at ${filePath}: ${error.message}`);
  }
}

function readBudgets(filePath) {
  const parsed = readJson(filePath, "budget file");
  const budgets = parsed && parsed.budgets;
  if (!budgets || typeof budgets !== "object") {
    fail(`Budget file must contain a budgets object (${filePath})`);
  }

  const required = ["unexpected", "flaky", "skipped"];
  for (const key of required) {
    const value = budgets[key];
    if (!Number.isInteger(value) || value < 0) {
      fail(`Budget ${key} must be a non-negative integer (got ${String(value)})`);
    }
  }

  return budgets;
}

function readAllowlist(filePath) {
  const parsed = readJson(filePath, "allowlist file");
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    fail(`Allowlist must be an object with an entries array (${filePath})`);
  }

  const now = Date.now();
  const entries = [];

  for (const entry of parsed.entries) {
    if (!entry || typeof entry !== "object") {
      fail("Allowlist entries must be objects");
    }

    const { outcome, allowance, owner, reason, expiresOn } = entry;
    if (!["unexpected", "flaky", "skipped"].includes(outcome)) {
      fail(`Allowlist entry has invalid outcome ${String(outcome)}`);
    }
    if (!Number.isInteger(allowance) || allowance < 0) {
      fail(`Allowlist entry for ${outcome} must have non-negative integer allowance`);
    }
    if (!owner || typeof owner !== "string") {
      fail(`Allowlist entry for ${outcome} is missing owner`);
    }
    if (!reason || typeof reason !== "string") {
      fail(`Allowlist entry for ${outcome} is missing reason`);
    }
    if (!expiresOn || typeof expiresOn !== "string") {
      fail(`Allowlist entry for ${outcome} is missing expiresOn`);
    }

    const expiry = new Date(`${expiresOn}T23:59:59.999Z`);
    if (Number.isNaN(expiry.getTime())) {
      fail(`Allowlist entry for ${outcome} has invalid expiresOn ${expiresOn}`);
    }
    if (expiry.getTime() < now) {
      fail(`Allowlist entry for ${outcome} expired on ${expiresOn}`);
    }

    entries.push({ outcome, allowance, owner, reason, expiresOn });
  }

  return entries;
}

function allowancesByOutcome(entries) {
  const totals = {
    unexpected: 0,
    flaky: 0,
    skipped: 0,
  };

  for (const entry of entries) {
    totals[entry.outcome] += entry.allowance;
  }

  return totals;
}

const budgets = readBudgets(budgetPath);
const allowlistEntries = readAllowlist(allowlistPath);
const allowances = allowancesByOutcome(allowlistEntries);

const report = readJson(reportPath, "reliability report");
const outcomes = report && report.outcomes;
if (!outcomes || typeof outcomes !== "object") {
  fail(`Reliability report must contain outcomes (${reportPath})`);
}

let hasViolation = false;
for (const key of ["unexpected", "flaky", "skipped"]) {
  const observed = Number(outcomes[key] || 0);
  const budget = budgets[key];
  const allowance = allowances[key] || 0;
  const threshold = budget + allowance;

  if (observed > threshold) {
    hasViolation = true;
    console.error(
      `[e2e-reliability-gate] ${key} exceeded threshold: observed=${observed} budget=${budget} allowance=${allowance} threshold=${threshold}`
    );
  }
}

console.log(
  `[e2e-reliability-gate] outcomes unexpected=${outcomes.unexpected || 0} flaky=${outcomes.flaky || 0} skipped=${outcomes.skipped || 0}`
);
console.log(
  `[e2e-reliability-gate] budgets unexpected=${budgets.unexpected} flaky=${budgets.flaky} skipped=${budgets.skipped}`
);

if (hasViolation) {
  process.exit(1);
}

console.log("[e2e-reliability-gate] reliability budgets satisfied");
