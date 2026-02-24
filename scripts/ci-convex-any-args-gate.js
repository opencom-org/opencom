#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const convexDir = path.resolve(__dirname, "..", "packages", "convex", "convex");
const registryPath = process.env.CONVEX_ANY_ARG_EXCEPTION_REGISTRY_PATH
  ? path.resolve(repoRoot, process.env.CONVEX_ANY_ARG_EXCEPTION_REGISTRY_PATH)
  : path.resolve(__dirname, "..", "security", "convex-v-any-arg-exceptions.json");

const HANDLER_KINDS = [
  "authMutation",
  "authQuery",
  "authAction",
  "mutation",
  "query",
  "action",
  "internalMutation",
  "internalQuery",
  "internalAction",
];

function fail(message) {
  console.error(`[convex-any-args-gate] ${message}`);
  process.exit(1);
}

function canonicalizePath(targetPath) {
  const resolved = path.resolve(targetPath);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function isOutsideRoot(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative.startsWith("..") || path.isAbsolute(relative);
}

function assertPathWithinRoot(rootPath, candidatePath, label) {
  const canonicalRoot = canonicalizePath(rootPath);
  const canonicalCandidate = canonicalizePath(candidatePath);
  if (isOutsideRoot(canonicalRoot, canonicalCandidate)) {
    fail(`${label} must resolve within ${canonicalRoot} (received ${canonicalCandidate}).`);
  }
}

assertPathWithinRoot(repoRoot, convexDir, "Convex source path");
assertPathWithinRoot(repoRoot, registryPath, "Exception registry path");

function keyOf(file, handler) {
  return `${file}:${handler}`;
}

function toIsoDate(value) {
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function walkTsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.resolve(dir, entry.name);
    assertPathWithinRoot(convexDir, absolute, "Discovered Convex file path");
    if (entry.isDirectory()) {
      if (entry.name === "_generated") {
        continue;
      }
      files.push(...walkTsFiles(absolute));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(absolute);
    }
  }
  return files;
}

function extractObjectBlock(text, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openBraceIndex, i + 1);
      }
    }
  }
  return null;
}

function findAnyArgHandlers() {
  const findings = [];
  const pattern = new RegExp(
    `export const\\s+([A-Za-z0-9_]+)\\s*=\\s*(${HANDLER_KINDS.join("|")})\\s*\\(\\{`,
    "g"
  );

  for (const filePath of walkTsFiles(convexDir)) {
    const source = fs.readFileSync(filePath, "utf8");

    let match;
    while ((match = pattern.exec(source)) !== null) {
      const handler = match[1];
      const kind = match[2];
      const blockStart = source.indexOf("{", match.index);
      const block = extractObjectBlock(source, blockStart);
      if (!block) {
        continue;
      }

      const argsIndex = block.indexOf("args");
      if (argsIndex === -1) {
        continue;
      }

      const handlerIndex = block.indexOf("handler", argsIndex);
      const argsSlice = block.slice(argsIndex, handlerIndex === -1 ? undefined : handlerIndex);
      if (!argsSlice.includes("v.any(")) {
        continue;
      }

      const line = source.slice(0, match.index).split("\n").length;
      const relativeFile = path.relative(process.cwd(), filePath).split(path.sep).join("/");
      findings.push({
        file: relativeFile,
        handler,
        kind,
        line,
      });
    }
  }

  return findings;
}

if (!fs.existsSync(registryPath)) {
  fail(`Exception registry not found: ${registryPath}`);
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
} catch (error) {
  fail(`Failed to parse exception registry: ${error.message}`);
}

if (!registry || typeof registry !== "object" || !Array.isArray(registry.entries)) {
  fail("Exception registry must be an object containing an entries array.");
}

const allowedRiskTiers = new Set(["high", "medium", "low"]);
const entryByKey = new Map();
for (const entry of registry.entries) {
  if (!entry || typeof entry !== "object") {
    fail("Exception entries must be objects.");
  }
  const required = [
    "file",
    "handler",
    "kind",
    "riskTier",
    "owner",
    "reason",
    "originalExpiresOn",
    "expiresOn",
    "justificationUpdatedOn",
  ];
  for (const field of required) {
    if (!entry[field]) {
      fail(`Exception entry missing required field: ${field}`);
    }
  }

  if (!allowedRiskTiers.has(entry.riskTier)) {
    fail(`Invalid riskTier for ${entry.file}:${entry.handler}: ${entry.riskTier}`);
  }

  const originalExpiry = toIsoDate(entry.originalExpiresOn);
  const currentExpiry = toIsoDate(entry.expiresOn);
  const justificationUpdatedOn = toIsoDate(entry.justificationUpdatedOn);
  if (!originalExpiry || !currentExpiry || !justificationUpdatedOn) {
    fail(`Invalid date in exception entry ${entry.file}:${entry.handler}`);
  }

  if (currentExpiry.getTime() !== originalExpiry.getTime()) {
    if (!entry.extensionJustification || typeof entry.extensionJustification !== "string") {
      fail(
        `Exception ${entry.file}:${entry.handler} extends expiry but has no extensionJustification`
      );
    }
  }

  const key = keyOf(entry.file, entry.handler);
  if (entryByKey.has(key)) {
    fail(`Duplicate exception entry for ${key}`);
  }

  entryByKey.set(key, entry);
}

const findings = findAnyArgHandlers();
const violations = [];
const seenKeys = new Set();

for (const finding of findings) {
  const key = keyOf(finding.file, finding.handler);
  seenKeys.add(key);

  const entry = entryByKey.get(key);
  if (!entry) {
    violations.push(
      `Undocumented v.any() usage in ${finding.file}:${finding.line} (${finding.handler}, ${finding.kind})`
    );
    continue;
  }

  if (entry.kind !== finding.kind) {
    violations.push(
      `Kind mismatch for ${finding.file}:${finding.handler} (registry=${entry.kind}, code=${finding.kind})`
    );
  }

  const expiry = toIsoDate(entry.expiresOn);
  if (!expiry || Date.now() > expiry.getTime()) {
    violations.push(
      `Expired v.any() exception for ${finding.file}:${finding.handler} (expired ${entry.expiresOn})`
    );
  }

  if (entry.riskTier === "high" || entry.riskTier === "medium") {
    violations.push(
      `High/medium risk v.any() exception not allowed: ${finding.file}:${finding.handler} (${entry.riskTier})`
    );
  }
}

for (const [key, entry] of entryByKey.entries()) {
  if (!seenKeys.has(key)) {
    violations.push(
      `Stale exception entry with no current v.any() usage: ${entry.file}:${entry.handler}`
    );
  }
}

if (violations.length > 0) {
  console.error("[convex-any-args-gate] Violations detected:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(
  `[convex-any-args-gate] OK: ${findings.length} v.any() arg exception(s) documented and valid.`
);
