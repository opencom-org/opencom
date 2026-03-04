#!/usr/bin/env node
"use strict";

const {
  ROOT_DIR,
  buildPublicDependencyGraph,
  compareSemver,
  detectChangedPublicPackages,
  ensureInCohort,
  getChangedFiles,
  getPackageManifest,
  parseArgs,
  parseReleaseTag,
  parseSemver,
  readPortfolio,
  runCommand,
  topoSort,
} = require("./lib");

function fail(message) {
  throw new Error(`[release-governance] ${message}`);
}

function gitStdout(args) {
  return runCommand("git", args, { cwd: ROOT_DIR, captureOutput: true }).stdout.trim();
}

function getManifestAtRef(ref, packagePath) {
  const json = gitStdout(["show", `${ref}:${packagePath}/package.json`]);
  return JSON.parse(json);
}

function validateNoWorkspaceProtocols(packageName, manifest) {
  const sections = ["dependencies", "peerDependencies", "optionalDependencies"];
  for (const section of sections) {
    for (const [dep, range] of Object.entries(manifest[section] || {})) {
      if (String(range).includes("workspace:")) {
        fail(`${packageName} has workspace protocol in ${section}.${dep}: ${range}`);
      }
    }
  }
}

function validatePackageMetadata(packageName, manifest, expected) {
  if (manifest.private !== false) {
    fail(`${packageName} must set "private": false`);
  }
  if (manifest.publishConfig?.access !== "public") {
    fail(`${packageName} must set publishConfig.access = "public"`);
  }
  if (!manifest.exports || typeof manifest.exports !== "object") {
    fail(`${packageName} must define stable exports`);
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail(`${packageName} must define a publish files list`);
  }
  if (!parseSemver(manifest.version)) {
    fail(`${packageName} has non-semver version: ${manifest.version}`);
  }

  const release = manifest.opencom?.release;
  if (!release || typeof release !== "object") {
    fail(`${packageName} must define opencom.release metadata`);
  }
  if (release.supportTier !== expected.supportTier) {
    fail(
      `${packageName} support tier mismatch. manifest=${release.supportTier} portfolio=${expected.supportTier}`
    );
  }

  const manifestChannels = Array.isArray(release.releaseChannels) ? release.releaseChannels : [];
  for (const channel of expected.releaseChannels || []) {
    if (!manifestChannels.includes(channel)) {
      fail(`${packageName} missing release channel "${channel}" in opencom.release.releaseChannels`);
    }
  }

  if (expected.convexCompatibility) {
    const compatibility = release.convexCompatibility;
    if (!compatibility || typeof compatibility !== "object") {
      fail(`${packageName} must define opencom.release.convexCompatibility`);
    }
    for (const key of ["minimum", "current", "maximum"]) {
      if (compatibility[key] !== expected.convexCompatibility[key]) {
        fail(
          `${packageName} convexCompatibility.${key} mismatch. manifest=${compatibility[key]} portfolio=${expected.convexCompatibility[key]}`
        );
      }
    }
  }
}

function validateTopology(portfolio, cohort) {
  const graph = buildPublicDependencyGraph(portfolio, cohort);
  const computed = topoSort(graph, cohort);
  if (JSON.stringify(computed) !== JSON.stringify(portfolio.publishTopology)) {
    fail(
      `publish topology mismatch. computed=${computed.join(" -> ")} config=${portfolio.publishTopology.join(" -> ")}`
    );
  }
}

function validateVersions(portfolio, cohort, tagInfo) {
  const versions = new Map();
  for (const packageName of cohort) {
    const { manifest } = getPackageManifest(packageName, portfolio);
    versions.set(packageName, manifest.version);
  }

  const uniqueVersions = [...new Set(versions.values())];
  if (uniqueVersions.length !== 1) {
    fail(
      `first cohort packages must use lockstep versioning. found: ${[...versions.entries()]
        .map(([name, version]) => `${name}@${version}`)
        .join(", ")}`
    );
  }

  const releaseVersion = uniqueVersions[0];
  if (tagInfo && tagInfo.version !== releaseVersion) {
    fail(
      `release tag version (${tagInfo.version}) must match first cohort version (${releaseVersion})`
    );
  }
}

function validateChangedPackagesVersionBumps(portfolio, cohort, baseRef, headRef) {
  const changedFiles = getChangedFiles(baseRef, headRef);
  const changedPackages = detectChangedPublicPackages(portfolio, changedFiles, cohort);

  for (const packageName of changedPackages) {
    const packagePath = portfolio.packages[packageName].path;
    const previous = getManifestAtRef(baseRef, packagePath);
    const next = getManifestAtRef(headRef, packagePath);

    if (compareSemver(next.version, previous.version) <= 0) {
      fail(
        `${packageName} changed between ${baseRef} and ${headRef} but version did not increase (${previous.version} -> ${next.version})`
      );
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const portfolio = readPortfolio();
  const cohort = portfolio.firstCohort;

  ensureInCohort(portfolio, cohort);
  validateTopology(portfolio, cohort);

  for (const packageName of cohort) {
    const expected = portfolio.packages[packageName];
    const { manifest } = getPackageManifest(packageName, portfolio);
    validateNoWorkspaceProtocols(packageName, manifest);
    validatePackageMetadata(packageName, manifest, expected);
  }

  let tagInfo = null;
  if (args.tag) {
    tagInfo = parseReleaseTag(args.tag, portfolio);
    if (args["expected-dist-tag"] && args["expected-dist-tag"] !== tagInfo.distTag) {
      fail(
        `dist-tag mismatch for ${args.tag}. expected ${args["expected-dist-tag"]}, got ${tagInfo.distTag}`
      );
    }
  }

  validateVersions(portfolio, cohort, tagInfo);

  if (args.base && args.head) {
    validateChangedPackagesVersionBumps(portfolio, cohort, args.base, args.head);
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        cohort,
        checkedTag: tagInfo?.tag || null,
        expectedDistTag: tagInfo?.distTag || null,
      },
      null,
      2
    ) + "\n"
  );
}

main();
