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
  readPortfolio,
  runCommand,
  topoSort,
  writeJson,
} = require("./lib");

function gitStdout(args) {
  return runCommand("git", args, { cwd: ROOT_DIR, captureOutput: true }).stdout.trim();
}

function inferBaseRef(headRef, tagPrefix) {
  try {
    const previous = gitStdout([
      "describe",
      "--tags",
      "--match",
      `${tagPrefix}*`,
      "--abbrev=0",
      `${headRef}^`,
    ]);
    if (previous) {
      return previous;
    }
  } catch {
    // No prior tag for this stream; fall back to repository root commit.
  }

  return gitStdout(["rev-list", "--max-parents=0", "HEAD"]);
}

function createPlan({ baseRef, headRef, portfolio }) {
  const cohort = portfolio.firstCohort;
  ensureInCohort(portfolio, cohort);

  const graph = buildPublicDependencyGraph(portfolio, cohort);
  const changedFiles = getChangedFiles(baseRef, headRef);
  const changedPackages = detectChangedPublicPackages(portfolio, changedFiles, cohort);
  const affectedPackages = collectAffectedPackages(changedPackages, graph);
  const publishOrder = topoSort(graph, affectedPackages);

  return {
    baseRef,
    headRef,
    cohort,
    changedPackageCount: changedPackages.length,
    changedPackages,
    affectedPackageCount: affectedPackages.length,
    affectedPackages,
    publishOrder,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const portfolio = readPortfolio();

  const headRef = args.head || "HEAD";
  const baseRef = args.base || inferBaseRef(headRef, portfolio.releaseGovernance.tagPrefix || "sdk-v");
  const outputPath = args.output ? path.resolve(ROOT_DIR, args.output) : null;

  const plan = createPlan({
    baseRef,
    headRef,
    portfolio,
  });

  if (args["require-changes"] && plan.affectedPackageCount === 0) {
    throw new Error("No changed first-cohort packages found in selected diff range.");
  }

  if (outputPath) {
    writeJson(outputPath, plan);
  }

  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
}

main();
