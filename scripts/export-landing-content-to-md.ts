#!/usr/bin/env tsx

import { chromium, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const DEFAULT_BASE_URL = process.env.LANDING_BASE_URL ?? "http://127.0.0.1:4000";
const DEFAULT_OUT_DIR = process.env.LANDING_MD_OUT_DIR ?? "artifacts/landing-help-center-md";
const LANDING_APP_SRC_DIR = path.resolve(process.cwd(), "apps", "landing", "src", "app");
const LANDING_MD_EXTRACTOR_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "lib",
  "landing-md-extractor.runtime.js"
);
const SERVER_READY_TIMEOUT_MS = 120_000;
const NAVIGATION_TIMEOUT_MS = 60_000;
const LANDING_MD_EXTRACTOR_SCRIPT = readFileSync(LANDING_MD_EXTRACTOR_PATH, "utf8");

type CliOptions = {
  baseUrl: string;
  outDir: string;
  noStartServer: boolean;
  routeFilters: string[];
};

type ExportRecord = {
  route: string;
  file: string;
  title: string;
  url: string;
};

type ExtractedPage = {
  title: string;
  markdown: string;
};

function printHelp() {
  console.log(`Export landing site content to Markdown files.

Usage:
  pnpm export:landing:md
  pnpm export:landing:md --base-url http://127.0.0.1:4000
  pnpm export:landing:md --routes /privacy,/roadmap
  pnpm export:landing:md --out-dir artifacts/my-help-center-md

Options:
  --base-url <url>      Base URL to crawl (default: ${DEFAULT_BASE_URL})
  --out-dir <path>      Output directory for markdown files (default: ${DEFAULT_OUT_DIR})
  --routes <csv>        Comma-separated routes to export (default: all landing routes)
  --no-start-server     Do not auto-start apps/landing dev server
  -h, --help            Show this help
`);
}

function normalizeRoute(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return `/${normalized}`;
}

function sanitizeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function routeToFileName(route: string): string {
  if (route === "/") {
    return "home.md";
  }
  const base = sanitizeFileName(route.slice(1).replace(/\//g, "-"));
  return `${base || "page"}.md`;
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.pathname === "/") {
    parsed.pathname = "";
  }
  return parsed.toString().replace(/\/$/, "");
}

function parseCliArgs(argv: string[]): CliOptions | null {
  const options: CliOptions = {
    baseUrl: DEFAULT_BASE_URL,
    outDir: path.resolve(process.cwd(), DEFAULT_OUT_DIR),
    noStartServer: false,
    routeFilters: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      return null;
    }

    if (arg === "--no-start-server") {
      options.noStartServer = true;
      continue;
    }

    if (arg === "--base-url" || arg === "--out-dir" || arg === "--routes") {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;

      if (arg === "--base-url") {
        options.baseUrl = nextValue;
      } else if (arg === "--out-dir") {
        options.outDir = path.resolve(process.cwd(), nextValue);
      } else {
        options.routeFilters = nextValue
          .split(",")
          .map((item) => normalizeRoute(item))
          .filter((item, itemIndex, arr) => arr.indexOf(item) === itemIndex);
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  return options;
}

async function collectLandingRoutes(dir: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const routes: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nestedPrefix = prefix ? path.join(prefix, entry.name) : entry.name;
      routes.push(...(await collectLandingRoutes(entryPath, nestedPrefix)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const isPageFile = /^page\.(tsx|ts|jsx|js|mdx)$/.test(entry.name);
    if (!isPageFile) {
      continue;
    }

    const route = prefix ? `/${prefix.split(path.sep).join("/")}` : "/";
    routes.push(normalizeRoute(route));
  }

  return routes;
}

async function isServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function startLandingDevServer(): ChildProcessWithoutNullStreams {
  const child = spawn("pnpm", ["--filter", "@opencom/landing", "dev"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[landing-dev] ${String(chunk)}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[landing-dev] ${String(chunk)}`);
  });

  return child;
}

async function waitForServer(
  baseUrl: string,
  timeoutMs: number,
  serverProcess?: ChildProcessWithoutNullStreams
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerReachable(baseUrl)) {
      return;
    }

    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`Landing dev server exited early with code ${serverProcess.exitCode}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for landing site at ${baseUrl}`);
}

async function stopProcess(serverProcess?: ChildProcessWithoutNullStreams): Promise<void> {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (serverProcess.exitCode === null) {
        serverProcess.kill("SIGKILL");
      }
      resolve();
    }, 5_000);

    serverProcess.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    serverProcess.kill("SIGTERM");
  });
}

function ensureTopHeading(markdown: string, title: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return `# ${title}\n`;
  }
  if (/^#\s+/m.test(trimmed)) {
    return `${trimmed}\n`;
  }
  return `# ${title}\n\n${trimmed}\n`;
}

function cleanExtractedMarkdown(markdown: string, route: string): string {
  let lines = markdown.split("\n");

  if (route === "/") {
    lines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }
      if (/^\d+$/.test(trimmed)) {
        return false;
      }
      if (/^\d+[smhd] ago$/i.test(trimmed)) {
        return false;
      }
      return true;
    });

    const startIndex = lines.findIndex((line) => line.trim() === "Live Inbox");
    if (startIndex !== -1) {
      const endIndex = lines.findIndex(
        (line, index) => index > startIndex && line.trim().startsWith("Ask AI Agent:")
      );
      if (endIndex !== -1) {
        lines.splice(startIndex, endIndex - startIndex + 1);
      }
    }
  }

  const firstHeadingIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));
  if (firstHeadingIndex > 0) {
    const prefix = lines.slice(0, firstHeadingIndex).filter((line) => line.trim().length > 0);
    const shouldDropPrefix =
      prefix.length > 0 && prefix.length <= 2 && prefix.every((line) => line.trim().length <= 50);
    if (shouldDropPrefix) {
      lines = lines.slice(firstHeadingIndex);
    }
  }

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractMarkdownFromPage(page: Page): Promise<ExtractedPage> {
  const extracted = await page.evaluate(
    (script) => window.eval(script),
    LANDING_MD_EXTRACTOR_SCRIPT
  );
  return extracted as ExtractedPage;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options) {
    return;
  }

  if (!existsSync(LANDING_APP_SRC_DIR)) {
    throw new Error(`Landing app directory not found: ${LANDING_APP_SRC_DIR}`);
  }

  const discoveredRoutes = (await collectLandingRoutes(LANDING_APP_SRC_DIR)).sort((a, b) => {
    if (a === "/") {
      return -1;
    }
    if (b === "/") {
      return 1;
    }
    return a.localeCompare(b);
  });

  if (discoveredRoutes.length === 0) {
    throw new Error(`No landing routes found under ${LANDING_APP_SRC_DIR}`);
  }

  const selectedRoutes =
    options.routeFilters.length > 0
      ? discoveredRoutes.filter((route) => options.routeFilters.includes(route))
      : discoveredRoutes;

  if (selectedRoutes.length === 0) {
    throw new Error(
      `No routes matched filters: ${options.routeFilters.join(", ")}. Available routes: ${discoveredRoutes.join(", ")}`
    );
  }

  for (const routeFilter of options.routeFilters) {
    if (!discoveredRoutes.includes(routeFilter)) {
      console.warn(`Skipping unknown route filter: ${routeFilter}`);
    }
  }

  let serverProcess: ChildProcessWithoutNullStreams | undefined;
  const records: ExportRecord[] = [];

  try {
    const reachable = await isServerReachable(options.baseUrl);
    if (!reachable) {
      if (options.noStartServer) {
        throw new Error(
          `Landing site is not reachable at ${options.baseUrl}. Start it with "pnpm --filter @opencom/landing dev" or remove --no-start-server.`
        );
      }

      console.log(`Landing site not reachable at ${options.baseUrl}. Starting local dev server...`);
      serverProcess = startLandingDevServer();
      await waitForServer(options.baseUrl, SERVER_READY_TIMEOUT_MS, serverProcess);
    }

    await fs.mkdir(options.outDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      for (const route of selectedRoutes) {
        const url = new URL(route, `${options.baseUrl}/`).toString();
        const page = await context.newPage();
        console.log(`Exporting ${route} -> ${url}`);

        await page.goto(url, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS });
        await page.waitForSelector("main", { timeout: 15_000 });

        const extracted = await extractMarkdownFromPage(page);
        const fileName = routeToFileName(route);
        const targetFile = path.join(options.outDir, fileName);
        const cleanedMarkdown = cleanExtractedMarkdown(extracted.markdown, route);
        const markdown = ensureTopHeading(cleanedMarkdown, extracted.title);

        await fs.writeFile(targetFile, markdown, "utf8");
        records.push({
          route,
          file: fileName,
          title: extracted.title,
          url,
        });

        await page.close();
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const manifestPath = path.join(options.outDir, "manifest.json");
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          baseUrl: options.baseUrl,
          count: records.length,
          pages: records,
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    console.log(`\nExport complete.`);
    console.log(`Markdown files: ${options.outDir}`);
    console.log(`Manifest: ${manifestPath}`);
  } finally {
    await stopProcess(serverProcess);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
