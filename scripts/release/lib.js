"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PORTFOLIO_PATH = path.join(__dirname, "portfolio.json");
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function readPortfolio() {
  const portfolio = readJson(PORTFOLIO_PATH);
  if (!portfolio?.packages || !portfolio?.firstCohort || !portfolio?.publishTopology) {
    throw new Error(`Invalid portfolio config at ${PORTFOLIO_PATH}`);
  }
  return portfolio;
}

function runCommand(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || ROOT_DIR,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: options.captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}${stderr}`);
  }
  return result;
}

function git(args, options = {}) {
  return runCommand("git", args, { ...options, captureOutput: true }).stdout.trim();
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function parseSemver(value) {
  const match = value.match(SEMVER_RE);
  if (!match) return null;
  return {
    raw: value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || null,
  };
}

function compareSemver(left, right) {
  const a = typeof left === "string" ? parseSemver(left) : left;
  const b = typeof right === "string" ? parseSemver(right) : right;
  if (!a || !b) {
    throw new Error(`Invalid semver comparison: ${left} vs ${right}`);
  }
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function parseRangeToken(value) {
  const trimmed = value.trim();
  if (trimmed.endsWith(".x")) {
    const parts = trimmed.split(".");
    if (parts.length !== 2) return null;
    const major = Number(parts[0]);
    if (!Number.isInteger(major)) return null;
    return { kind: "major", major };
  }

  const parsed = parseSemver(trimmed);
  if (parsed) {
    return { kind: "exact", version: parsed };
  }
  return null;
}

function versionSatisfiesRange(version, rangeToken) {
  const parsedVersion = parseSemver(version);
  if (!parsedVersion) return false;
  const parsedRange = parseRangeToken(rangeToken);
  if (!parsedRange) return false;
  if (parsedRange.kind === "major") {
    return parsedVersion.major === parsedRange.major;
  }
  return compareSemver(parsedVersion, parsedRange.version) === 0;
}

function absolutePath(relativePath) {
  return path.join(ROOT_DIR, relativePath);
}

function getPackageManifestByPath(packagePath) {
  const manifestPath = absolutePath(path.join(packagePath, "package.json"));
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing package manifest: ${manifestPath}`);
  }
  return {
    manifestPath,
    manifest: readJson(manifestPath),
  };
}

function getPackageManifest(packageName, portfolio) {
  const entry = portfolio.packages[packageName];
  if (!entry) {
    throw new Error(`Package not present in portfolio: ${packageName}`);
  }
  return getPackageManifestByPath(entry.path);
}

function getPublicPackageNames(portfolio) {
  return Object.entries(portfolio.packages)
    .filter(([, config]) => String(config.classification || "").startsWith("public-"))
    .map(([name]) => name);
}

function getDependencyNames(manifest) {
  return new Set([
    ...Object.keys(manifest.dependencies || {}),
    ...Object.keys(manifest.peerDependencies || {}),
    ...Object.keys(manifest.optionalDependencies || {}),
  ]);
}

function buildPublicDependencyGraph(portfolio, packageNames) {
  const names = packageNames || getPublicPackageNames(portfolio);
  const set = new Set(names);
  const graph = new Map();
  for (const name of names) {
    const { manifest } = getPackageManifest(name, portfolio);
    const deps = [...getDependencyNames(manifest)].filter((dep) => set.has(dep));
    graph.set(name, deps);
  }
  return graph;
}

function buildDependentsGraph(graph) {
  const dependents = new Map();
  for (const [name] of graph.entries()) {
    dependents.set(name, []);
  }
  for (const [name, deps] of graph.entries()) {
    for (const dep of deps) {
      dependents.get(dep).push(name);
    }
  }
  return dependents;
}

function topoSort(graph, selectedNames) {
  const selectedSet = new Set(selectedNames || graph.keys());
  const inDegree = new Map();
  for (const name of selectedSet) {
    inDegree.set(name, 0);
  }

  for (const [name, deps] of graph.entries()) {
    if (!selectedSet.has(name)) continue;
    for (const dep of deps) {
      if (!selectedSet.has(dep)) continue;
      inDegree.set(name, (inDegree.get(name) || 0) + 1);
    }
  }

  const queue = [];
  for (const [name, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);
    for (const [name, deps] of graph.entries()) {
      if (!selectedSet.has(name) || !deps.includes(current)) continue;
      const nextDegree = (inDegree.get(name) || 0) - 1;
      inDegree.set(name, nextDegree);
      if (nextDegree === 0) {
        queue.push(name);
      }
    }
  }

  if (sorted.length !== selectedSet.size) {
    throw new Error("Dependency cycle detected in public package graph.");
  }
  return sorted;
}

function listGitTags(prefix) {
  const output = git(["tag", "--list", `${prefix}*`, "--sort=-creatordate"]);
  if (!output) return [];
  return output
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseReleaseTag(tag, portfolio) {
  const prefix = portfolio.releaseGovernance.tagPrefix || "sdk-v";
  if (!tag.startsWith(prefix)) {
    throw new Error(`Release tag must start with ${prefix}`);
  }
  const version = tag.slice(prefix.length);
  const parsed = parseSemver(version);
  if (!parsed) {
    throw new Error(`Release tag version must be semver: ${tag}`);
  }
  const prerelease = parsed.prerelease !== null;
  return {
    tag,
    version,
    prerelease,
    distTag: prerelease
      ? portfolio.releaseGovernance.distTags.prerelease
      : portfolio.releaseGovernance.distTags.stable,
  };
}

function getChangedFiles(baseRef, headRef) {
  const diffTarget = `${baseRef}...${headRef}`;
  const output = git(["diff", "--name-only", diffTarget]);
  if (!output) return [];
  return output
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

function packageChanged(changedFiles, packagePath) {
  const normalized = packagePath.replace(/\/+$/, "") + "/";
  return changedFiles.some((file) => file.startsWith(normalized));
}

function detectChangedPublicPackages(portfolio, changedFiles, packageNames) {
  const targetPackages = packageNames || portfolio.firstCohort;
  return targetPackages.filter((name) => {
    const entry = portfolio.packages[name];
    if (!entry) return false;
    return packageChanged(changedFiles, entry.path);
  });
}

function collectAffectedPackages(changedPackages, graph) {
  const affected = new Set(changedPackages);
  const dependents = buildDependentsGraph(graph);
  const queue = [...changedPackages];
  while (queue.length > 0) {
    const current = queue.shift();
    const downstream = dependents.get(current) || [];
    for (const dependent of downstream) {
      if (affected.has(dependent)) continue;
      affected.add(dependent);
      queue.push(dependent);
    }
  }
  return [...affected];
}

function ensureInCohort(portfolio, packageNames) {
  const allowed = new Set(portfolio.firstCohort);
  for (const packageName of packageNames) {
    if (!allowed.has(packageName)) {
      throw new Error(`Package is not in first release cohort: ${packageName}`);
    }
  }
}

module.exports = {
  ROOT_DIR,
  PORTFOLIO_PATH,
  absolutePath,
  buildPublicDependencyGraph,
  collectAffectedPackages,
  compareSemver,
  detectChangedPublicPackages,
  ensureInCohort,
  getChangedFiles,
  getPackageManifest,
  getPublicPackageNames,
  listGitTags,
  parseArgs,
  parseReleaseTag,
  parseSemver,
  readJson,
  readPortfolio,
  runCommand,
  topoSort,
  versionSatisfiesRange,
  writeJson,
};
