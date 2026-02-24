#!/usr/bin/env node

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const allowlistPath = process.env.AUDIT_ALLOWLIST_PATH
  ? path.resolve(process.cwd(), process.env.AUDIT_ALLOWLIST_PATH)
  : path.resolve(__dirname, "..", "security", "dependency-audit-allowlist.json");

function fail(message) {
  console.error(`[audit-gate] ${message}`);
  process.exit(1);
}

function readAllowlist(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Allowlist file not found: ${filePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Unable to parse allowlist JSON at ${filePath}: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    fail(`Allowlist must be an object with an "entries" array: ${filePath}`);
  }

  for (const entry of parsed.entries) {
    if (!entry || typeof entry !== "object") {
      fail("Allowlist entries must be objects.");
    }

    if (!entry.id) {
      fail('Allowlist entries must include "id".');
    }
    if (!entry.owner) {
      fail(`Allowlist entry ${entry.id} is missing "owner".`);
    }
    if (!entry.expiresOn) {
      fail(`Allowlist entry ${entry.id} is missing "expiresOn".`);
    }

    const expires = new Date(`${entry.expiresOn}T23:59:59.999Z`);
    if (Number.isNaN(expires.getTime())) {
      fail(
        `Allowlist entry ${entry.id} has invalid expiresOn value "${entry.expiresOn}" (expected YYYY-MM-DD).`
      );
    }
  }

  return parsed.entries;
}

function runAudit() {
  try {
    return execSync("pnpm audit --json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 30 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim().length > 0) {
      return error.stdout;
    }
    fail(`pnpm audit failed without JSON output: ${error.message}`);
  }
}

function parseAuditOutput(output) {
  try {
    return JSON.parse(output);
  } catch (error) {
    fail(`Failed to parse pnpm audit JSON output: ${error.message}`);
  }
}

function isBlockingSeverity(severity) {
  return severity === "high" || severity === "critical";
}

function isAllowlistExpired(entry) {
  const expires = new Date(`${entry.expiresOn}T23:59:59.999Z`);
  return Date.now() > expires.getTime();
}

const allowlistEntries = readAllowlist(allowlistPath);
const auditReport = parseAuditOutput(runAudit());
const advisories = Object.entries(auditReport.advisories ?? {}).map(([id, advisory]) => ({
  id: String(id),
  module: advisory.module_name,
  severity: advisory.severity,
  title: advisory.title,
  url: advisory.url,
}));

const blockingAdvisories = advisories.filter((advisory) => isBlockingSeverity(advisory.severity));

if (blockingAdvisories.length === 0) {
  console.log("[audit-gate] No high/critical advisories found.");
  process.exit(0);
}

const allowed = [];
const violations = [];

for (const advisory of blockingAdvisories) {
  const entry = allowlistEntries.find((candidate) => {
    const idMatches = String(candidate.id) === advisory.id;
    const moduleMatches = !candidate.module || candidate.module === advisory.module;
    return idMatches && moduleMatches;
  });

  if (!entry) {
    violations.push({
      advisory,
      reason: "not allowlisted",
    });
    continue;
  }

  if (isAllowlistExpired(entry)) {
    violations.push({
      advisory,
      reason: `allowlist entry expired on ${entry.expiresOn} (owner: ${entry.owner})`,
    });
    continue;
  }

  allowed.push({ advisory, entry });
}

if (violations.length > 0) {
  console.error("[audit-gate] Blocking advisories detected:");
  for (const { advisory, reason } of violations) {
    console.error(
      `  - [${advisory.severity}] ${advisory.module} (id=${advisory.id}): ${advisory.title}`
    );
    console.error(`    reason: ${reason}`);
    if (advisory.url) {
      console.error(`    advisory: ${advisory.url}`);
    }
  }
  process.exit(1);
}

console.log(
  `[audit-gate] All ${blockingAdvisories.length} high/critical advisories are allowlisted.`
);
for (const { advisory, entry } of allowed) {
  console.log(
    `  - [${advisory.severity}] ${advisory.module} (id=${advisory.id}) allowlisted until ${entry.expiresOn} (owner: ${entry.owner})`
  );
}
