#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const registryPath = process.env.CONVEX_RAW_HANDLER_REGISTRY_PATH
  ? path.resolve(repoRoot, process.env.CONVEX_RAW_HANDLER_REGISTRY_PATH)
  : path.resolve(__dirname, "..", "security", "convex-raw-handler-registry.json");
const convexSourceRoot = path.resolve(repoRoot, "packages", "convex", "convex");

function fail(message) {
  console.error(`[convex-auth-guard] ${message}`);
  process.exit(1);
}

function canonicalizePath(targetPath) {
  const normalized = path.normalize(targetPath);
  const absolutePath = path.isAbsolute(normalized) ? normalized : path.join(repoRoot, normalized);
  try {
    return fs.realpathSync.native(absolutePath);
  } catch {
    return absolutePath;
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

assertPathWithinRoot(repoRoot, registryPath, "Registry path");
assertPathWithinRoot(repoRoot, convexSourceRoot, "Convex source root");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function walkConvexFiles(dirPath) {
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === "_generated") {
      continue;
    }
    const absolutePath = path.resolve(dirPath, entry.name);
    assertPathWithinRoot(convexSourceRoot, absolutePath, "Discovered Convex path");
    if (entry.isDirectory()) {
      files.push(...walkConvexFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && absolutePath.endsWith(".ts")) {
      files.push(absolutePath);
    }
  }
  return files;
}

function findCallObjectStart(source, exportIndex) {
  const parenIndex = source.indexOf("(", exportIndex);
  if (parenIndex === -1) {
    return -1;
  }

  for (let i = parenIndex + 1; i < source.length; i += 1) {
    const char = source[i];
    if (/\s/.test(char)) {
      continue;
    }
    return char === "{" ? i : -1;
  }

  return -1;
}

function extractBalancedObject(source, objectStart) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = objectStart; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      if (!escaped && char === "'") {
        inSingleQuote = false;
      }
      escaped = !escaped && char === "\\";
      continue;
    }

    if (inDoubleQuote) {
      if (!escaped && char === '"') {
        inDoubleQuote = false;
      }
      escaped = !escaped && char === "\\";
      continue;
    }

    if (inTemplateString) {
      if (!escaped && char === "`") {
        inTemplateString = false;
      }
      escaped = !escaped && char === "\\";
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      escaped = false;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      escaped = false;
      continue;
    }

    if (char === "`") {
      inTemplateString = true;
      escaped = false;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(objectStart, i + 1);
      }
      if (depth < 0) {
        return null;
      }
    }
  }

  return null;
}

function parsePrivilegedRawHandlers(filePath, guardRegexes) {
  const source = fs.readFileSync(filePath, "utf8");
  const handlers = [];
  const exportPattern = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*(mutation|query|action)\s*\(/g;

  let match;
  while ((match = exportPattern.exec(source)) !== null) {
    const objectStart = findCallObjectStart(source, match.index);
    if (objectStart === -1) {
      continue;
    }

    const objectBody = extractBalancedObject(source, objectStart);
    if (!objectBody) {
      continue;
    }

    const guardMarkers = guardRegexes
      .filter((guardRegex) => guardRegex.regex.test(objectBody))
      .map((guardRegex) => guardRegex.marker);

    if (guardMarkers.length === 0) {
      continue;
    }

    const line = source.slice(0, match.index).split("\n").length;
    handlers.push({
      handler: match[1],
      kind: match[2],
      line,
      guardMarkers,
    });
  }

  return handlers;
}

function buildModuleSnapshots(guardMarkers) {
  const guardRegexes = guardMarkers.map((marker) => ({
    marker,
    regex: new RegExp(`\\b${marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*\\(`),
  }));

  const modules = new Map();
  for (const filePath of walkConvexFiles(convexSourceRoot)) {
    const handlers = parsePrivilegedRawHandlers(filePath, guardRegexes);
    if (handlers.length === 0) {
      continue;
    }

    const file = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    const canonicalHandlers = handlers
      .map((handler) => ({
        ...handler,
        canonical: `${handler.handler}:${handler.kind}:${handler.guardMarkers.join("+")}`,
      }))
      .sort((a, b) => a.canonical.localeCompare(b.canonical));

    const digest = sha256(canonicalHandlers.map((handler) => handler.canonical).join("\n"));
    modules.set(file, {
      file,
      handlerCount: canonicalHandlers.length,
      digest,
      handlers: canonicalHandlers,
    });
  }

  return modules;
}

if (!fs.existsSync(registryPath)) {
  fail(`Registry file not found: ${registryPath}`);
}

if (!fs.existsSync(convexSourceRoot)) {
  fail(`Convex source root not found: ${convexSourceRoot}`);
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
} catch (error) {
  fail(`Failed to parse registry JSON at ${registryPath}: ${error.message}`);
}

if (!registry || typeof registry !== "object") {
  fail("Registry must be a JSON object.");
}

if (registry.version !== 2) {
  fail("Registry version mismatch. Expected version=2.");
}

if (!Array.isArray(registry.guardMarkers) || registry.guardMarkers.length === 0) {
  fail('Registry must include a non-empty "guardMarkers" array.');
}

if (!Array.isArray(registry.moduleSnapshots)) {
  fail('Registry must include a "moduleSnapshots" array.');
}

const registryByFile = new Map();
for (const snapshot of registry.moduleSnapshots) {
  if (!snapshot || typeof snapshot !== "object") {
    fail("Each module snapshot entry must be an object.");
  }

  if (!snapshot.file || typeof snapshot.file !== "string") {
    fail("Each module snapshot must include a file path.");
  }

  const snapshotPath = path.resolve(repoRoot, snapshot.file);
  assertPathWithinRoot(convexSourceRoot, snapshotPath, `Registry snapshot path (${snapshot.file})`);

  if (typeof snapshot.handlerCount !== "number" || snapshot.handlerCount <= 0) {
    fail(`Invalid handlerCount for ${snapshot.file}`);
  }

  if (!snapshot.digest || typeof snapshot.digest !== "string") {
    fail(`Missing digest for ${snapshot.file}`);
  }

  if (registryByFile.has(snapshot.file)) {
    fail(`Duplicate module snapshot entry for ${snapshot.file}`);
  }

  registryByFile.set(snapshot.file, snapshot);
}

const discoveredByFile = buildModuleSnapshots(registry.guardMarkers);
const violations = [];

for (const [file, discovered] of discoveredByFile.entries()) {
  const expected = registryByFile.get(file);
  if (!expected) {
    violations.push({
      type: "unreviewed_privileged_module",
      message: `Unreviewed privileged raw exports detected in ${file}`,
      details: `handlerCount=${discovered.handlerCount}, digest=${discovered.digest}`,
    });
    continue;
  }

  if (expected.handlerCount !== discovered.handlerCount || expected.digest !== discovered.digest) {
    violations.push({
      type: "snapshot_mismatch",
      message:
        `Privileged raw handler snapshot drift in ${file} (expected count=${expected.handlerCount}, digest=${expected.digest}; ` +
        `actual count=${discovered.handlerCount}, digest=${discovered.digest})`,
    });
  }
}

for (const [file, expected] of registryByFile.entries()) {
  if (!discoveredByFile.has(file)) {
    violations.push({
      type: "stale_registry_entry",
      message: `Registry snapshot has no matching privileged raw exports in source: ${file} (digest=${expected.digest})`,
    });
  }
}

if (violations.length > 0) {
  console.error("[convex-auth-guard] Violations detected:");
  for (const violation of violations) {
    console.error(`  - ${violation.message}`);
    if (violation.details) {
      console.error(`    ${violation.details}`);
    }
  }
  process.exit(1);
}

const totalHandlers = [...discoveredByFile.values()].reduce(
  (sum, snapshot) => sum + snapshot.handlerCount,
  0
);

console.log(
  `[convex-auth-guard] OK: validated ${totalHandlers} privileged raw exports across ${discoveredByFile.size} module snapshot(s).`
);
console.log(`[convex-auth-guard] Guard markers: ${registry.guardMarkers.join(", ")}`);
