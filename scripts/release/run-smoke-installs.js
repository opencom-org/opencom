#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ROOT_DIR,
  absolutePath,
  parseArgs,
  readPortfolio,
  runCommand,
  writeJson,
} = require("./lib");

function fail(message) {
  throw new Error(`[smoke-install] ${message}`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeTarballPrefix(packageName) {
  return packageName.replace(/^@/, "").replace(/\//g, "-");
}

function findTarball(packDir, packageName) {
  const prefix = `${normalizeTarballPrefix(packageName)}-`;
  const candidates = fs
    .readdirSync(packDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".tgz"))
    .map((name) => ({
      name,
      fullPath: path.join(packDir, name),
      mtimeMs: fs.statSync(path.join(packDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.fullPath || null;
}

function packPackage(packageName, packagePath, packDir) {
  runCommand("pnpm", ["pack", "--pack-destination", packDir], {
    cwd: path.join(ROOT_DIR, packagePath),
  });
  const tarballPath = findTarball(packDir, packageName);
  if (!tarballPath) {
    fail(`Unable to locate tarball for ${packageName} in ${packDir}`);
  }
  return tarballPath;
}

function writeFixturePackageJson(fixtureDir, dependencies, overrides = {}) {
  writeJson(path.join(fixtureDir, "package.json"), {
    name: "opencom-release-smoke-fixture",
    version: "0.0.0",
    private: true,
    dependencies,
    pnpm: {
      overrides,
    },
  });
}

function runInstall(fixtureDir) {
  runCommand("pnpm", ["install", "--ignore-scripts", "--frozen-lockfile=false"], {
    cwd: fixtureDir,
  });
}

function runSdkCoreSmoke(fixtureRoot, tarballs) {
  const fixtureDir = path.join(fixtureRoot, "sdk-core-consumer");
  ensureDir(fixtureDir);
  const convexTarball = `file:${tarballs["@opencom/convex"]}`;
  const sdkCoreTarball = `file:${tarballs["@opencom/sdk-core"]}`;
  writeFixturePackageJson(
    fixtureDir,
    {
      "@opencom/convex": convexTarball,
      "@opencom/sdk-core": sdkCoreTarball,
      react: "^19.1.0",
    },
    {
      "@opencom/convex": convexTarball,
      "@opencom/sdk-core": sdkCoreTarball,
    }
  );
  runInstall(fixtureDir);

  const checkScript = `
const sdk = require("@opencom/sdk-core");
if (typeof sdk.initializeClient !== "function") {
  throw new Error("initializeClient export missing");
}
if (typeof sdk.bootSession !== "function") {
  throw new Error("bootSession export missing");
}
if (typeof sdk.assertConvexContractCompatibility !== "function") {
  throw new Error("assertConvexContractCompatibility export missing");
}
`;
  runCommand("node", ["-e", checkScript], { cwd: fixtureDir });
}

function runReactNativeSmoke(fixtureRoot, tarballs) {
  const fixtureDir = path.join(fixtureRoot, "react-native-sdk-consumer");
  ensureDir(fixtureDir);
  const convexTarball = `file:${tarballs["@opencom/convex"]}`;
  const sdkCoreTarball = `file:${tarballs["@opencom/sdk-core"]}`;
  const rnTarball = `file:${tarballs["@opencom/react-native-sdk"]}`;
  writeFixturePackageJson(
    fixtureDir,
    {
      "@opencom/convex": convexTarball,
      "@opencom/sdk-core": sdkCoreTarball,
      "@opencom/react-native-sdk": rnTarball,
      convex: "^1.31.7",
      react: "^19.1.0",
      "react-native": "^0.81.5",
    },
    {
      "@opencom/convex": convexTarball,
      "@opencom/sdk-core": sdkCoreTarball,
      "@opencom/react-native-sdk": rnTarball,
    }
  );
  runInstall(fixtureDir);

  const checkScript = `
const fs = require("node:fs");
const path = require("node:path");
const pkgDir = path.join(process.cwd(), "node_modules", "@opencom", "react-native-sdk");
const pkgJsonPath = path.join(pkgDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
const exportsMap = pkg.exports || {};
for (const key of [".", "./plugin"]) {
  if (!exportsMap[key]) {
    throw new Error("Missing export " + key);
  }
}
const requiredFiles = [
  path.join(pkgDir, "lib/typescript/index.d.ts"),
  path.join(pkgDir, "lib/module/index.js"),
  path.join(pkgDir, "plugin/build/index.js")
];
for (const filePath of requiredFiles) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Missing published file: " + filePath);
  }
}
`;
  runCommand("node", ["-e", checkScript], { cwd: fixtureDir });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const portfolio = readPortfolio();
  const cohort = portfolio.firstCohort;
  const packDir = absolutePath(args["pack-dir"] || "artifacts/release-tarballs");
  ensureDir(packDir);

  const tarballs = {};
  for (const packageName of cohort) {
    const packagePath = portfolio.packages[packageName].path;
    tarballs[packageName] = packPackage(packageName, packagePath, packDir);
  }

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opencom-smoke-"));
  runSdkCoreSmoke(fixtureRoot, tarballs);
  runReactNativeSmoke(fixtureRoot, tarballs);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        fixtureRoot,
        tarballs,
      },
      null,
      2
    ) + "\n"
  );
}

main();
