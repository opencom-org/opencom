#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const secretScanExceptionsPath = path.join(repoRoot, "security", "secret-scan-exceptions.json");

const EXCLUDED_PREFIXES = [
  "apps/web/.next/",
  "apps/landing/.next/",
  "apps/landing/out/",
  "packages/android-sdk/",
  "packages/ios-sdk/",
  "apps/landing/public/opencom-widget.iife.js",
  "apps/web/public/opencom-widget.iife.js",
  "apps/widget/dist/opencom-widget.iife.js",
  "packages/convex/dist/",
  "packages/react-native-sdk/lib/",
  "packages/react-native-sdk/dist/",
];

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".txt",
  ".env",
  ".example",
]);

const KNOWN_LITERAL_PATTERNS = [
  {
    id: "convex_deploy_key_format",
    regex: /\b(?:prod:[a-z0-9-]+|[a-z0-9-]{3,})\|[A-Za-z0-9+/=]{24,}\b/g,
    message: "Potential Convex deploy key format",
  },
  {
    id: "provider_secret_like_key",
    regex: /\b(?:sk_(?:live|test)|rk_(?:live|test)|gh[pousr])_[A-Za-z0-9]{16,}\b/g,
    message: "Potential provider secret token",
  },
  {
    id: "google_api_key_format",
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    message: "Potential Google API key",
  },
];

const SENSITIVE_ENV_ASSIGNMENT =
  /\b(TEST_ADMIN_SECRET|RESEND_WEBHOOK_SECRET|EMAIL_WEBHOOK_INTERNAL_SECRET|CONVEX_DEPLOY_KEY)[ \t]*=[ \t]*([^\s`"']+)/g;

function fail(message) {
  console.error(`[secret-scan] ${message}`);
  process.exit(1);
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizeException(raw, index) {
  if (!raw || typeof raw !== "object") {
    fail(`Invalid exception entry at index ${index}: expected object`);
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const rule = typeof raw.rule === "string" ? raw.rule.trim() : "";
  const file = typeof raw.file === "string" ? raw.file.trim() : "";
  const owner = typeof raw.owner === "string" ? raw.owner.trim() : "";
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  const expiresOn = typeof raw.expiresOn === "string" ? raw.expiresOn.trim() : "";
  const line = raw.line == null ? null : Number(raw.line);
  const snippetIncludes =
    typeof raw.snippetIncludes === "string" && raw.snippetIncludes.trim().length > 0
      ? raw.snippetIncludes
      : null;

  if (!id || !rule || !file || !owner || !reason || !expiresOn) {
    fail(
      `Invalid exception entry at index ${index}: id, rule, file, owner, reason, and expiresOn are required`
    );
  }

  if (line != null && (!Number.isInteger(line) || line <= 0)) {
    fail(`Invalid exception entry '${id}': line must be a positive integer when provided`);
  }

  const expiresAt = parseIsoDate(expiresOn);
  if (!expiresAt) {
    fail(`Invalid exception entry '${id}': expiresOn must be YYYY-MM-DD`);
  }

  return {
    id,
    rule,
    file,
    owner,
    reason,
    expiresOn,
    expiresAt,
    line,
    snippetIncludes,
  };
}

function loadReviewedExceptions() {
  if (!fs.existsSync(secretScanExceptionsPath)) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(secretScanExceptionsPath, "utf8"));
  } catch (error) {
    fail(`Failed to parse ${path.relative(repoRoot, secretScanExceptionsPath)}: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.exceptions)) {
    fail(
      `Invalid ${path.relative(repoRoot, secretScanExceptionsPath)}: expected top-level 'exceptions' array`
    );
  }

  return parsed.exceptions.map(normalizeException);
}

function findingMatchesException(finding, exception) {
  if (finding.rule !== exception.rule) {
    return false;
  }
  if (finding.file !== exception.file) {
    return false;
  }
  if (exception.line != null && finding.line !== exception.line) {
    return false;
  }
  if (exception.snippetIncludes && !finding.snippet.includes(exception.snippetIncludes)) {
    return false;
  }
  return true;
}

function partitionFindingsByException(findings, exceptions) {
  const today = new Date().toISOString().slice(0, 10);
  const allowed = [];
  const blocked = [];

  for (const finding of findings) {
    const match = exceptions.find((exception) => findingMatchesException(finding, exception));
    if (!match) {
      blocked.push(finding);
      continue;
    }

    if (match.expiresOn < today) {
      blocked.push({
        ...finding,
        message: `${finding.message} (matched expired exception: ${match.id})`,
      });
      continue;
    }

    allowed.push({ finding, exception: match });
  }

  return { allowed, blocked };
}

function getTrackedFiles() {
  try {
    const output = execSync("git ls-files -z", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.split("\0").filter(Boolean);
  } catch (error) {
    fail(`Failed to list tracked files: ${error.message}`);
  }
}

function isExcluded(file) {
  return EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isCandidateTextFile(file) {
  if (isExcluded(file)) {
    return false;
  }

  if (
    file.endsWith(".env.local") ||
    file.endsWith(".env.test") ||
    file.endsWith(".env.production")
  ) {
    return true;
  }

  if (path.basename(file).startsWith(".env.")) {
    return true;
  }

  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isLikelyBinary(contents) {
  return contents.includes("\u0000");
}

function toLineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function getLineSnippet(source, lineNumber) {
  const line = source.split("\n")[lineNumber - 1] ?? "";
  return line.trim().slice(0, 220);
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isPlaceholderValue(rawValue) {
  const value = stripWrappingQuotes(rawValue.trim());
  if (!value) {
    return true;
  }

  if (value.startsWith("<") && value.endsWith(">")) {
    return true;
  }

  if (value.startsWith("${") || value.startsWith("$")) {
    return true;
  }

  if (value.includes("...")) {
    return true;
  }

  if (/^x+$/i.test(value)) {
    return true;
  }

  const placeholderTokens = [
    "your",
    "example",
    "placeholder",
    "changeme",
    "redacted",
    "secret",
    "token",
    "url",
  ];

  const lower = value.toLowerCase();
  return placeholderTokens.some((token) => lower.includes(token));
}

function collectFindings(file, source) {
  const findings = [];

  for (const pattern of KNOWN_LITERAL_PATTERNS) {
    let match;
    while ((match = pattern.regex.exec(source)) !== null) {
      const line = toLineNumber(source, match.index);
      findings.push({
        file,
        line,
        rule: pattern.id,
        message: pattern.message,
        snippet: getLineSnippet(source, line),
      });
    }
    pattern.regex.lastIndex = 0;
  }

  let envMatch;
  while ((envMatch = SENSITIVE_ENV_ASSIGNMENT.exec(source)) !== null) {
    const variable = envMatch[1];
    const value = envMatch[2];
    if (isPlaceholderValue(value)) {
      continue;
    }

    const line = toLineNumber(source, envMatch.index);
    findings.push({
      file,
      line,
      rule: "sensitive_env_assignment",
      message: `Literal ${variable} assignment in tracked file`,
      snippet: getLineSnippet(source, line),
    });
  }
  SENSITIVE_ENV_ASSIGNMENT.lastIndex = 0;

  return findings;
}

const files = getTrackedFiles().filter(isCandidateTextFile);
let scannedFiles = 0;
const findings = [];
const reviewedExceptions = loadReviewedExceptions();

for (const file of files) {
  const absolutePath = path.join(repoRoot, file);
  let source;
  try {
    source = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    fail(`Failed to read ${file}: ${error.message}`);
  }

  if (isLikelyBinary(source)) {
    continue;
  }

  scannedFiles += 1;
  findings.push(...collectFindings(file, source));
}

const { allowed, blocked } = partitionFindingsByException(findings, reviewedExceptions);

if (allowed.length > 0) {
  console.log(`[secret-scan] Applied ${allowed.length} reviewed exception(s):`);
  for (const entry of allowed) {
    const { finding, exception } = entry;
    console.log(
      `  - ${finding.file}:${finding.line} [${finding.rule}] exception=${exception.id} owner=${exception.owner} expiresOn=${exception.expiresOn}`
    );
  }
}

if (blocked.length > 0) {
  console.error("[secret-scan] Potential secret exposure(s) detected:");
  for (const finding of blocked) {
    console.error(`  - ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
    if (finding.snippet) {
      console.error(`    ${finding.snippet}`);
    }
  }
  console.error("[secret-scan] Redact values and rotate/revoke credentials where applicable.");
  process.exit(1);
}

console.log(
  `[secret-scan] OK: scanned ${scannedFiles} tracked text file(s), no blocked patterns found.`
);
