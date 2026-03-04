#!/usr/bin/env node
"use strict";

const {
  getPackageManifest,
  parseArgs,
  parseSemver,
  readPortfolio,
  runCommand,
  compareSemver,
} = require("./lib");

function fail(message) {
  throw new Error(`[convex-compat] ${message}`);
}

function assertRangeLooksValid(packageName, compatibility) {
  const minimum = compatibility.minimum;
  const current = compatibility.current;
  const maximum = compatibility.maximum;

  if (!parseSemver(minimum)) {
    fail(`${packageName} has invalid minimum convex compatibility version: ${minimum}`);
  }
  if (!parseSemver(current)) {
    fail(`${packageName} has invalid current convex compatibility version: ${current}`);
  }
  if (!maximum || typeof maximum !== "string") {
    fail(`${packageName} must define convex compatibility maximum range`);
  }
  if (compareSemver(current, minimum) < 0) {
    fail(`${packageName} convex compatibility current (${current}) is lower than minimum (${minimum})`);
  }
}

function runCompatibilityCommand(command, version) {
  const env = {
    ...process.env,
    OPENCOM_CONVEX_CONTRACT_VERSION: version,
  };
  runCommand("bash", ["-lc", command], { env });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const portfolio = readPortfolio();
  const cohort = portfolio.firstCohort;

  const matrix = [];
  for (const packageName of cohort) {
    const entry = portfolio.packages[packageName];
    if (!entry?.convexCompatibility) {
      continue;
    }
    const { manifest } = getPackageManifest(packageName, portfolio);
    const release = manifest.opencom?.release || {};
    const compatibility = release.convexCompatibility;
    if (!compatibility) {
      fail(`${packageName} missing opencom.release.convexCompatibility metadata`);
    }

    assertRangeLooksValid(packageName, compatibility);

    const command = release.compatibilityTestCommand;
    if (!command || typeof command !== "string") {
      fail(`${packageName} missing opencom.release.compatibilityTestCommand`);
    }

    const versions = [...new Set([compatibility.minimum, compatibility.current])];
    for (const version of versions) {
      matrix.push({
        packageName,
        version,
        command,
      });
    }
  }

  if (matrix.length === 0) {
    fail("No Convex compatibility matrix entries found.");
  }

  if (args["skip-tests"]) {
    process.stdout.write(JSON.stringify({ ok: true, matrix, skipped: true }, null, 2) + "\n");
    return;
  }

  for (const entry of matrix) {
    process.stdout.write(
      `[convex-compat] ${entry.packageName} against contract ${entry.version}: ${entry.command}\n`
    );
    runCompatibilityCommand(entry.command, entry.version);
  }

  process.stdout.write(JSON.stringify({ ok: true, matrix, skipped: false }, null, 2) + "\n");
}

main();
