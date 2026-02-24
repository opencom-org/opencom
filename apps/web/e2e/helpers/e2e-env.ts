import * as fs from "node:fs";
import * as path from "node:path";

const WEB_APP_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(WEB_APP_ROOT, "..", "..");

const ENV_FILE_CANDIDATES = [
  path.join(WEB_APP_ROOT, ".env.local"),
  path.join(WEB_APP_ROOT, ".env"),
  path.join(REPO_ROOT, ".env.local"),
  path.join(REPO_ROOT, ".env"),
];

function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function readEnvVarFromFiles(variableName: string): string | undefined {
  for (const envFilePath of ENV_FILE_CANDIDATES) {
    if (!fs.existsSync(envFilePath)) {
      continue;
    }

    const fileContents = fs.readFileSync(envFilePath, "utf-8");
    const parsed = parseEnvFile(fileContents);
    const value = parsed[variableName];

    if (value) {
      return value;
    }
  }

  return undefined;
}

export function resolveE2EBackendUrl(): string {
  const fromProcess = process.env.E2E_BACKEND_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  if (fromProcess) {
    return fromProcess;
  }

  const fromEnvFiles =
    readEnvVarFromFiles("E2E_BACKEND_URL") || readEnvVarFromFiles("NEXT_PUBLIC_CONVEX_URL");

  if (fromEnvFiles) {
    process.env.E2E_BACKEND_URL ??= fromEnvFiles;
    process.env.NEXT_PUBLIC_CONVEX_URL ??= fromEnvFiles;
    return fromEnvFiles;
  }

  throw new Error(
    "E2E_BACKEND_URL (or NEXT_PUBLIC_CONVEX_URL) must be set for E2E tests. " +
      "Set it in your shell or define it in apps/web/.env.local."
  );
}
