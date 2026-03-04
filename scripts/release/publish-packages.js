#!/usr/bin/env node
"use strict";

const path = require("node:path");
const {
  ROOT_DIR,
  buildPublicDependencyGraph,
  collectAffectedPackages,
  detectChangedPublicPackages,
  ensureInCohort,
  getChangedFiles,
  parseArgs,
  parseReleaseTag,
  readPortfolio,
  runCommand,
  topoSort,
} = require("./lib");

function packageSupportsScript(manifest, scriptName) {
  return Boolean(manifest.scripts && manifest.scripts[scriptName]);
}

function runNodeScript(scriptName, extraArgs = []) {
  runCommand("node", [path.join("scripts", "release", scriptName), ...extraArgs], {
    cwd: ROOT_DIR,
  });
}

function runPackageQualityChecks(portfolio, packageNames) {
  for (const packageName of packageNames) {
    const packagePath = portfolio.packages[packageName].path;
    const manifestPath = path.join(ROOT_DIR, packagePath, "package.json");
    const manifest = require(manifestPath);

    if (packageSupportsScript(manifest, "build")) {
      runCommand("pnpm", ["--filter", packageName, "build"], { cwd: ROOT_DIR });
    }
    if (packageSupportsScript(manifest, "typecheck")) {
      runCommand("pnpm", ["--filter", packageName, "typecheck"], { cwd: ROOT_DIR });
    }

    const customReleaseTest = manifest.opencom?.release?.releaseTestCommand;
    if (typeof customReleaseTest === "string" && customReleaseTest.trim().length > 0) {
      runCommand("bash", ["-lc", customReleaseTest], { cwd: ROOT_DIR });
    } else if (packageSupportsScript(manifest, "test")) {
      runCommand("pnpm", ["--filter", packageName, "test"], { cwd: ROOT_DIR });
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const portfolio = readPortfolio();
  const cohort = portfolio.firstCohort;
  ensureInCohort(portfolio, cohort);

  const headRef = args.head || "HEAD";
  const baseRef = args.base || "HEAD~1";
  const changedFiles = getChangedFiles(baseRef, headRef);
  const changedPackages = detectChangedPublicPackages(portfolio, changedFiles, cohort);
  const graph = buildPublicDependencyGraph(portfolio, cohort);
  const affectedPackages = collectAffectedPackages(changedPackages, graph);
  const publishOrder = topoSort(graph, affectedPackages);
  const dryRun = Boolean(args["dry-run"]);

  const governanceArgs = [];
  if (args.tag) {
    governanceArgs.push("--tag", args.tag);
  }
  if (args.base && args.head) {
    governanceArgs.push("--base", args.base, "--head", args.head);
  }
  runNodeScript("validate-release-governance.js", governanceArgs);
  runNodeScript("validate-convex-compatibility.js");

  if (publishOrder.length === 0) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          message: "No first-cohort package changes detected. Nothing to publish.",
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  runPackageQualityChecks(portfolio, publishOrder);

  const smokeArgs = [];
  if (args["pack-dir"]) {
    smokeArgs.push("--pack-dir", args["pack-dir"]);
  }
  runNodeScript("run-smoke-installs.js", smokeArgs);

  let distTag = args["dist-tag"] || portfolio.releaseGovernance.distTags.stable || "latest";
  if (args.tag) {
    distTag = parseReleaseTag(args.tag, portfolio).distTag;
  }

  for (const packageName of publishOrder) {
    const publishArgs = [
      "--filter",
      packageName,
      "publish",
      "--access",
      "public",
      "--tag",
      distTag,
      "--no-git-checks",
      "--provenance",
    ];
    if (dryRun) {
      publishArgs.push("--dry-run");
    }
    runCommand("pnpm", publishArgs, { cwd: ROOT_DIR });
  }

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        baseRef,
        headRef,
        distTag,
        changedPackages,
        publishOrder,
      },
      null,
      2
    ) + "\n"
  );
}

main();
