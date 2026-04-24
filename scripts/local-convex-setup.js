"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { spawn } = require("node:child_process");
const readline = require("node:readline/promises");

const {
  CORE_BACKEND_ENV,
  LOCAL_ENV_TARGETS,
  OPTIONAL_BACKEND_PROFILES,
} = require("./lib/local-convex-setup-manifest");

const ROOT_DIR = path.resolve(__dirname, "..");
const CONVEX_ENV_FILE = path.join("packages", "convex", ".env.local");
const COLORS = {
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  bold: "\u001b[1m",
  reset: "\u001b[0m",
};

class SetupError extends Error {
  constructor({ summary, why, fix, details }) {
    super(summary);
    this.name = "SetupError";
    this.summary = summary;
    this.why = why;
    this.fix = Array.isArray(fix) ? fix : fix ? [fix] : [];
    this.details = details || "";
  }
}

function colorize(color, value, runtime) {
  if (!runtime.output.isTTY) {
    return value;
  }
  return `${color}${value}${COLORS.reset}`;
}

function formatSectionTitle(value, runtime) {
  return colorize(COLORS.bold + COLORS.blue, value, runtime);
}

function logSection(runtime, title) {
  runtime.log(`\n${formatSectionTitle(title, runtime)}`);
}

function logSuccess(runtime, message) {
  runtime.log(`${colorize(COLORS.green, "✓", runtime)} ${message}`);
}

function logWarning(runtime, message) {
  runtime.warn(`${colorize(COLORS.yellow, "!", runtime)} ${message}`);
}

function parseEnvAssignment(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) {
    return null;
  }

  return {
    key: match[1],
    rawValue: match[2],
  };
}

function unquoteEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvContent(content) {
  const values = {};
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  for (const line of lines) {
    const parsed = parseEnvAssignment(line);
    if (!parsed) {
      continue;
    }
    values[parsed.key] = unquoteEnvValue(parsed.rawValue);
  }
  return values;
}

function formatEnvValue(value) {
  const stringValue = String(value);
  return `"${stringValue
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")}"`;
}

function formatConvexEnvFileValue(value) {
  const stringValue = String(value);
  if (stringValue.includes('"') && !stringValue.includes("'")) {
    return `'${stringValue}'`;
  }
  return formatEnvValue(value);
}

function mergeEnvFileContent(existingContent, desiredEntries, managedComment) {
  const desiredKeys = Object.keys(desiredEntries);
  const normalized = existingContent.replace(/\r\n/g, "\n");
  const hasContent = normalized.length > 0;
  const lines = hasContent ? normalized.split("\n") : [];
  const seenKeys = new Set();

  const mergedLines = lines.map((line) => {
    const parsed = parseEnvAssignment(line);
    if (!parsed || !Object.prototype.hasOwnProperty.call(desiredEntries, parsed.key)) {
      return line;
    }

    seenKeys.add(parsed.key);
    return `${parsed.key}=${formatEnvValue(desiredEntries[parsed.key])}`;
  });

  const missingKeys = desiredKeys.filter((key) => !seenKeys.has(key));
  if (missingKeys.length > 0) {
    if (mergedLines.length > 0 && mergedLines[mergedLines.length - 1] !== "") {
      mergedLines.push("");
    }
    mergedLines.push(`# ${managedComment}`);
    for (const key of missingKeys) {
      mergedLines.push(`${key}=${formatEnvValue(desiredEntries[key])}`);
    }
  }

  let result = mergedLines.join("\n");
  if (!result.endsWith("\n")) {
    result = `${result}\n`;
  }
  return result;
}

function generateJwtKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const jwtPrivateKey = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .trimEnd()
    .replace(/\n/g, " ");
  const publicJwk = publicKey.export({ format: "jwk" });
  return {
    JWT_PRIVATE_KEY: jwtPrivateKey,
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...publicJwk }] }),
  };
}

function isValidJwtPrivateKey(value) {
  const normalized = String(value || "").trim();
  return (
    normalized.startsWith("-----BEGIN PRIVATE KEY-----") &&
    normalized.endsWith("-----END PRIVATE KEY-----")
  );
}

function isValidJwks(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.keys) &&
      parsed.keys.length > 0
    );
  } catch {
    return false;
  }
}

function isValidCoreBackendEnvValue(entry, key, value) {
  if (!value) {
    return false;
  }
  if (entry.resolution !== "generate-jwt-keypair") {
    return true;
  }
  if (key === "JWT_PRIVATE_KEY") {
    return isValidJwtPrivateKey(value);
  }
  if (key === "JWKS") {
    return isValidJwks(value);
  }
  return true;
}

function trimCommandOutput(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function toErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readEnvFile(filePath) {
  if (!(await fileExists(filePath))) {
    return {};
  }
  const content = await fs.readFile(filePath, "utf8");
  return parseEnvContent(content);
}

function createTerminalUi({ input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, output });

  async function ask(question, options = {}) {
    const suffix =
      options.defaultValue !== undefined && options.defaultValue !== ""
        ? ` [${options.defaultValue}]`
        : "";

    while (true) {
      const answer = await rl.question(`${question}${suffix}: `);
      const resolved = answer.trim() || options.defaultValue || "";
      if (resolved || !options.required) {
        return resolved;
      }
      output.write("This value is required.\n");
    }
  }

  async function askSecret(question, options = {}) {
    if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
      return ask(question, options);
    }

    const suffix =
      options.defaultValue !== undefined && options.defaultValue !== ""
        ? ` [${"*".repeat(String(options.defaultValue).length)}]`
        : "";

    output.write(`${question}${suffix}: `);
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    return await new Promise((resolve, reject) => {
      let value = "";

      function cleanup() {
        input.off("data", onData);
        input.setRawMode(Boolean(wasRaw));
        input.pause();
      }

      function finish(resolvedValue) {
        cleanup();
        output.write("\n");
        resolve(resolvedValue);
      }

      function onData(chunk) {
        const characters = Array.from(chunk);
        for (const character of characters) {
          if (character === "\u0003") {
            cleanup();
            reject(new Error("Interrupted"));
            return;
          }

          if (character === "\r" || character === "\n") {
            const resolved = value || options.defaultValue || "";
            if (!resolved && options.required) {
              output.write("\nThis value is required.\n");
              output.write(`${question}${suffix}: `);
              value = "";
              continue;
            }
            finish(resolved);
            return;
          }

          if (character === "\u007f" || character === "\b") {
            if (value.length > 0) {
              value = value.slice(0, -1);
              output.write("\b \b");
            }
            continue;
          }

          value += character;
          output.write("*");
        }
      }

      input.on("data", onData);
    });
  }

  async function confirm(question, defaultValue = true) {
    const prompt = defaultValue ? " [Y/n]: " : " [y/N]: ";
    const answer = (await rl.question(`${question}${prompt}`)).trim().toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    return answer === "y" || answer === "yes";
  }

  async function select(question, options, defaultIndex = 0) {
    output.write(`${question}\n`);
    options.forEach((option, index) => {
      const marker = index === defaultIndex ? " (default)" : "";
      output.write(`  ${index + 1}. ${option.label}${marker}\n`);
    });

    while (true) {
      const answer = (await rl.question("Choose an option: ")).trim();
      const index = answer ? Number.parseInt(answer, 10) - 1 : defaultIndex;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        return options[index].value;
      }
      output.write("Enter one of the numbered options above.\n");
    }
  }

  return {
    ask,
    askSecret,
    confirm,
    select,
    close: async () => {
      rl.close();
    },
  };
}

function createRuntime(overrides = {}) {
  const input = overrides.input || process.stdin;
  const output = overrides.output || process.stdout;
  const ui = overrides.ui || createTerminalUi({ input, output });
  return {
    rootDir: overrides.rootDir || ROOT_DIR,
    input,
    output,
    ui,
    fetchImpl: overrides.fetchImpl || global.fetch,
    generateJwtKeyPair: overrides.generateJwtKeyPair || generateJwtKeyPair,
    log: overrides.log || ((message) => output.write(`${message}\n`)),
    warn: overrides.warn || ((message) => output.write(`${message}\n`)),
    error: overrides.error || ((message) => output.write(`${message}\n`)),
    async readFile(filePath, encoding = "utf8") {
      return fs.readFile(filePath, encoding);
    },
    async writeFile(filePath, contents) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents, "utf8");
    },
    async exists(filePath) {
      return fileExists(filePath);
    },
    async runCommand(command, args, options = {}) {
      return runCommand(command, args, {
        cwd: options.cwd || this.rootDir,
        env: options.env,
        stdio: options.stdio || "pipe",
      });
    },
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      stdio: options.stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }

      const error = new Error(
        `Command failed: ${command} ${args.join(" ")}\n${trimCommandOutput(stderr || stdout)}`
      );
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function sanitizeConvexUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/$/, "");
}

function convexCloudToSiteUrl(value) {
  return sanitizeConvexUrl(value).replace(/\.convex\.cloud$/, ".convex.site");
}

async function getConvexConfig(runtime) {
  const env = await readEnvFile(path.join(runtime.rootDir, CONVEX_ENV_FILE));
  const convexUrl = sanitizeConvexUrl(env.CONVEX_URL || env.E2E_BACKEND_URL || "");
  return {
    env,
    convexUrl,
    deployment: String(env.CONVEX_DEPLOYMENT || "").trim(),
  };
}

async function installDependencies(runtime) {
  logSection(runtime, "1. Install Dependencies");
  runtime.log("Running pnpm install so the workspace and Convex CLI are ready for setup.");
  try {
    await runtime.runCommand("pnpm", ["install"], { stdio: "inherit" });
  } catch (error) {
    throw new SetupError({
      summary: "pnpm install failed.",
      why: "The local bootstrap cannot continue until the workspace dependencies are installed.",
      fix: [
        "Resolve the pnpm install failure shown above, then rerun ./scripts/setup.sh.",
        "If you are setting up pnpm for the first time, confirm `pnpm -v` works in this shell.",
      ],
      details: toErrorMessage(error),
    });
  }
  logSuccess(runtime, "Dependencies installed.");
}

async function ensureConvexDeployment(runtime, options) {
  logSection(runtime, "2. Configure Or Reuse The Convex Dev Deployment");
  const existing = await getConvexConfig(runtime);
  let shouldReconfigure = Boolean(options.reconfigure);

  if (!existing.deployment || !existing.convexUrl) {
    runtime.log(
      "No usable local Convex deployment metadata was found. Starting the Convex CLI flow."
    );
  } else if (!shouldReconfigure) {
    runtime.log(`Found existing deployment ${existing.deployment} in packages/convex/.env.local.`);
    if (!options.nonInteractive) {
      const reuse = await runtime.ui.confirm(
        "Reuse the currently configured Convex deployment?",
        true
      );
      shouldReconfigure = !reuse;
    }
  }

  if (!existing.deployment || !existing.convexUrl || shouldReconfigure) {
    const args = ["--filter", "@opencom/convex", "exec", "convex", "dev", "--once"];
    if (shouldReconfigure) {
      args.push("--configure");
    }

    try {
      await runtime.runCommand("pnpm", args, { stdio: "inherit" });
    } catch (error) {
      throw new SetupError({
        summary: "Convex project configuration failed.",
        why: "The rest of the bootstrap needs a working dev deployment before it can validate auth or write local env files.",
        fix: [
          "Finish any login/project-selection prompts from the Convex CLI, then rerun ./scripts/setup.sh.",
          "If you wanted a different deployment, rerun ./scripts/setup.sh --reconfigure.",
          "If the CLI completed successfully but the file still looks wrong, inspect packages/convex/.env.local.",
        ],
        details: toErrorMessage(error),
      });
    }
  }

  const refreshed = await getConvexConfig(runtime);
  if (!refreshed.deployment || !refreshed.convexUrl) {
    throw new SetupError({
      summary: "Convex setup did not produce the deployment metadata this repo expects.",
      why: "Opencom needs both CONVEX_DEPLOYMENT and CONVEX_URL in packages/convex/.env.local to continue safely.",
      fix: [
        "Rerun ./scripts/setup.sh --reconfigure and complete the Convex CLI flow.",
        "If the CLI already succeeded, inspect packages/convex/.env.local for CONVEX_DEPLOYMENT and CONVEX_URL.",
      ],
    });
  }

  logSuccess(runtime, `Using deployment ${refreshed.deployment}.`);
  logSuccess(runtime, `Resolved backend URL ${refreshed.convexUrl}.`);
  return refreshed;
}

async function getBackendEnvValue(runtime, key) {
  try {
    const result = await runtime.runCommand("pnpm", [
      "--filter",
      "@opencom/convex",
      "exec",
      "convex",
      "env",
      "get",
      key,
    ]);
    return trimCommandOutput(result.stdout);
  } catch (error) {
    const message = trimCommandOutput(error.stderr || error.stdout || "");
    if (/not set|could not find|No environment variable/i.test(message)) {
      return "";
    }
    throw error;
  }
}

async function setBackendEnvValue(runtime, key, value) {
  await runtime.runCommand(
    "pnpm",
    ["--filter", "@opencom/convex", "exec", "convex", "env", "set", key, value],
    { stdio: "inherit" }
  );
}

async function setBackendEnvValues(runtime, values, options = {}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencom-convex-env-"));
  const tempEnvFile = path.join(tempDir, "env.values");
  const content =
    Object.entries(values)
      .map(([key, value]) => `${key}=${formatConvexEnvFileValue(value)}`)
      .join("\n") + "\n";

  try {
    await runtime.writeFile(tempEnvFile, content);
    const args = [
      "--filter",
      "@opencom/convex",
      "exec",
      "convex",
      "env",
      "set",
      "--from-file",
      tempEnvFile,
    ];
    if (options.force) {
      args.push("--force");
    }
    await runtime.runCommand("pnpm", args, { stdio: "inherit" });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function ensureCoreBackendEnv(runtime) {
  logSection(runtime, "3. Validate Backend Auth Bootstrap Env");
  const resolvedValues = {};

  for (const entry of CORE_BACKEND_ENV) {
    if (entry.resolution === "generate-jwt-keypair") {
      const keys = entry.keys || [];
      const currentValues = {};
      for (const key of keys) {
        currentValues[key] = await getBackendEnvValue(runtime, key);
      }

      const missingKeys = keys.filter(
        (key) => !isValidCoreBackendEnvValue(entry, key, currentValues[key])
      );
      if (missingKeys.length > 0) {
        const generatedValues = runtime.generateJwtKeyPair();
        const desiredValues = Object.fromEntries(keys.map((key) => [key, generatedValues[key]]));
        try {
          await setBackendEnvValues(runtime, desiredValues, { force: true });
          Object.assign(currentValues, desiredValues);
        } catch (error) {
          throw new SetupError({
            summary: `Could not set required backend env ${missingKeys.join(", ")}.`,
            why: entry.description,
            fix: [
              "Run `pnpm --filter @opencom/convex exec convex auth add`, then rerun ./scripts/setup.sh.",
              "If either JWT_PRIVATE_KEY or JWKS is missing, regenerate and set both values from the same key pair.",
            ],
            details: toErrorMessage(error),
          });
        }
      }

      for (const key of keys) {
        resolvedValues[key] = currentValues[key];
      }
      logSuccess(runtime, `${keys.join(" and ")} are configured.`);
      continue;
    }

    let currentValue = await getBackendEnvValue(runtime, entry.key);
    if (!currentValue) {
      if (entry.resolution === "default") {
        currentValue = entry.defaultValue;
      }

      try {
        await setBackendEnvValue(runtime, entry.key, currentValue);
      } catch (error) {
        if (entry.required) {
          throw new SetupError({
            summary: `Could not set required backend env ${entry.key}.`,
            why: entry.description,
            fix: [
              `Run \`pnpm --filter @opencom/convex exec convex env set ${entry.key} <value>\`, then rerun ./scripts/setup.sh.`,
            ],
            details: toErrorMessage(error),
          });
        }

        logWarning(
          runtime,
          `Could not set optional backend env ${entry.key}. ${entry.description}`
        );
        continue;
      }
    }

    resolvedValues[entry.key] = currentValue;
    if (entry.required) {
      logSuccess(runtime, `${entry.key} is configured.`);
    } else {
      logSuccess(runtime, `${entry.key} is configured or defaulted for local use.`);
    }
  }

  return resolvedValues;
}

async function callConvexJson(runtime, convexUrl, kind, pathName, args, token) {
  if (typeof runtime.fetchImpl !== "function") {
    throw new SetupError({
      summary: "Fetch is not available in this Node runtime.",
      why: "The setup bootstrap uses HTTP calls to the configured Convex deployment for auth and workspace resolution.",
      fix: ["Use Node.js 18+ and rerun ./scripts/setup.sh."],
    });
  }

  const url = `${sanitizeConvexUrl(convexUrl)}/api/${kind}`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const body = {
    path: pathName,
    args: args || {},
  };

  if (kind === "action") {
    body.format = "json";
  }

  let response;
  try {
    response = await runtime.fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new SetupError({
      summary: `Could not reach ${pathName} on the configured Convex deployment.`,
      why: "The bootstrap cannot verify auth or workspace state when the backend is unreachable.",
      fix: [
        "Confirm the Convex dev deployment is running and that CONVEX_URL points at the correct instance.",
        "If you reconfigured the deployment, rerun ./scripts/setup.sh --reconfigure.",
      ],
      details: toErrorMessage(error),
    });
  }

  const responseText = await response.text();
  let payload;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = responseText;
  }

  if (!response.ok) {
    const details =
      typeof payload === "string"
        ? payload
        : JSON.stringify(payload, null, 2) || response.statusText;
    throw new SetupError({
      summary: `${pathName} returned HTTP ${response.status}.`,
      why: "The bootstrap step could not complete with the backend response it received.",
      fix: [
        "Inspect the backend error below, fix the misconfiguration, then rerun ./scripts/setup.sh.",
      ],
      details,
    });
  }

  if (payload && typeof payload === "object" && payload.status === "error") {
    throw new Error(payload.errorMessage || JSON.stringify(payload));
  }

  if (
    payload &&
    typeof payload === "object" &&
    payload.status === "success" &&
    "value" in payload
  ) {
    return payload.value;
  }

  return payload;
}

async function getSetupState(runtime, convexUrl) {
  return callConvexJson(runtime, convexUrl, "query", "setup:checkExistingSetup", {});
}

function emailPrefix(email) {
  return String(email).split("@")[0] || "Opencom Admin";
}

async function collectSignupCredentials(runtime, options) {
  const email =
    options.adminEmail ||
    (options.nonInteractive ? "" : await runtime.ui.ask("Admin email", { required: true }));
  const password =
    options.adminPassword ||
    (options.nonInteractive
      ? ""
      : await runtime.ui.askSecret("Admin password", { required: true }));

  if (!email || !password) {
    throw new SetupError({
      summary: "Email and password are required for non-interactive bootstrap.",
      why: "The script cannot create the bootstrap admin account without credentials.",
      fix: ["Pass --email and --password, or rerun ./scripts/setup.sh without --non-interactive."],
    });
  }

  const adminName =
    options.adminName ||
    (options.nonInteractive
      ? emailPrefix(email)
      : await runtime.ui.ask("Admin display name", {
          defaultValue: emailPrefix(email),
        }));

  const workspaceName =
    options.workspaceName ||
    (options.nonInteractive
      ? ""
      : await runtime.ui.ask("Workspace name (leave blank to use the default)", {
          defaultValue: "",
        }));

  return {
    email,
    password,
    adminName,
    workspaceName,
  };
}

async function collectSigninCredentials(runtime, options) {
  const email =
    options.adminEmail ||
    (options.nonInteractive
      ? ""
      : await runtime.ui.ask("Existing admin email", { required: true }));
  const password =
    options.adminPassword ||
    (options.nonInteractive
      ? ""
      : await runtime.ui.askSecret("Existing admin password", { required: true }));

  if (!email || !password) {
    throw new SetupError({
      summary: "Existing admin credentials are required for non-interactive reruns.",
      why: "The bootstrap needs to authenticate before it can list or reuse the existing workspaces on this deployment.",
      fix: ["Pass --email and --password, or rerun ./scripts/setup.sh without --non-interactive."],
    });
  }

  return { email, password };
}

function authErrorFixes(errorMessage) {
  const normalized = errorMessage.toLowerCase();
  const fixes = [];

  if (normalized.includes("invalid credentials") || normalized.includes("account not found")) {
    fixes.push(
      "Use an existing admin account on this deployment, or rerun against a different deployment."
    );
  }

  if (
    normalized.includes("auth_secret") ||
    normalized.includes("jwt_private_key") ||
    normalized.includes("jwks") ||
    normalized.includes("convex_site_url") ||
    normalized.includes("missing environment variable") ||
    normalized.includes("openid") ||
    normalized.includes("issuer") ||
    normalized.includes("site_url")
  ) {
    fixes.push(
      "Confirm JWT_PRIVATE_KEY and JWKS are set from the same key pair, and that CONVEX_SITE_URL is available on the deployment."
    );
  }

  if (fixes.length === 0) {
    fixes.push(
      "Check the backend error below, correct the auth configuration or credentials, then rerun the setup."
    );
  }

  return fixes;
}

async function signInWithPassword(runtime, convexUrl, params) {
  try {
    const response = await callConvexJson(runtime, convexUrl, "action", "auth:signIn", {
      provider: "password",
      params,
    });
    const token = response?.tokens?.token;
    if (!token) {
      throw new Error("auth:signIn did not return a JWT token.");
    }
    return token;
  } catch (error) {
    const message = error instanceof SetupError ? error.summary : toErrorMessage(error);
    const details = error instanceof SetupError ? error.details || toErrorMessage(error) : message;
    const fixInput = `${message}\n${details}`;
    throw new SetupError({
      summary: `Password auth bootstrap failed: ${message}`,
      why: "The local setup flow relies on the repo's real Convex Auth password sign-in/sign-up path.",
      fix: authErrorFixes(fixInput),
      details,
    });
  }
}

async function getCurrentUser(runtime, convexUrl, token) {
  return callConvexJson(runtime, convexUrl, "query", "auth:currentUser", {}, token);
}

async function createWorkspace(runtime, convexUrl, token, workspaceName) {
  try {
    return await callConvexJson(
      runtime,
      convexUrl,
      "mutation",
      "workspaces:create",
      { name: workspaceName },
      token
    );
  } catch (error) {
    throw new SetupError({
      summary: `Could not create workspace "${workspaceName}".`,
      why: "The deployment already had users, and the bootstrap could not create the explicitly requested new workspace.",
      fix: [
        "Try a different workspace name, or choose one of the existing workspaces on the deployment.",
      ],
      details: toErrorMessage(error),
    });
  }
}

async function switchWorkspace(runtime, convexUrl, token, workspaceId) {
  await callConvexJson(
    runtime,
    convexUrl,
    "mutation",
    "auth:switchWorkspace",
    { workspaceId },
    token
  );
}

function findWorkspace(workspaces, workspaceId) {
  return (workspaces || []).find((workspace) => workspace && workspace._id === workspaceId) || null;
}

async function chooseWorkspace(runtime, options, currentUserPayload, convexUrl, token) {
  const workspaces = currentUserPayload?.workspaces || [];
  const activeWorkspaceId = currentUserPayload?.user?.workspaceId || null;

  if (workspaces.length === 0 && !options.createWorkspace) {
    throw new SetupError({
      summary: "The authenticated account does not have any workspaces to reuse.",
      why: "Opencom needs a workspace ID before it can populate the local env files.",
      fix: [
        'Create a workspace in the app and rerun the bootstrap, or rerun ./scripts/setup.sh --create-workspace --workspace "My Workspace".',
      ],
    });
  }

  if (options.createWorkspace) {
    const workspaceName =
      options.workspaceName ||
      (options.nonInteractive
        ? ""
        : await runtime.ui.ask("New workspace name", { required: true }));
    if (!workspaceName) {
      throw new SetupError({
        summary:
          "A workspace name is required when creating a new workspace on an existing deployment.",
        why: "The bootstrap cannot create a new workspace without a name.",
        fix: [
          'Pass --workspace "My Workspace", or rerun interactively and provide the name when prompted.',
        ],
      });
    }

    const workspaceId = await createWorkspace(runtime, convexUrl, token, workspaceName);
    await switchWorkspace(runtime, convexUrl, token, workspaceId);
    return { workspaceId, created: true };
  }

  if (options.nonInteractive || workspaces.length === 1) {
    return {
      workspaceId: activeWorkspaceId || workspaces[0]._id,
      created: false,
    };
  }

  const choices = workspaces.map((workspace) => ({
    label:
      workspace._id === activeWorkspaceId
        ? `${workspace.name} (${workspace.role}, current)`
        : `${workspace.name} (${workspace.role})`,
    value: workspace._id,
  }));
  choices.push({
    label: "Create a new workspace for this account",
    value: "__create_workspace__",
  });

  const defaultIndex = Math.max(
    choices.findIndex((choice) => choice.value === activeWorkspaceId),
    0
  );

  const selected = await runtime.ui.select(
    "Choose the workspace to wire into your local env files:",
    choices,
    defaultIndex
  );

  if (selected === "__create_workspace__") {
    const workspaceName = await runtime.ui.ask("New workspace name", { required: true });
    const workspaceId = await createWorkspace(runtime, convexUrl, token, workspaceName);
    await switchWorkspace(runtime, convexUrl, token, workspaceId);
    return { workspaceId, created: true };
  }

  if (selected !== activeWorkspaceId) {
    await switchWorkspace(runtime, convexUrl, token, selected);
  }

  return { workspaceId: selected, created: false };
}

async function resolveWorkspace(runtime, options, convexConfig) {
  logSection(runtime, "4. Create Or Reuse The Bootstrap Workspace");
  const state = await getSetupState(runtime, convexConfig.convexUrl);

  if (!state?.hasUsers) {
    runtime.log(
      "The deployment is empty, so the bootstrap will create the first admin account/workspace."
    );
    const credentials = await collectSignupCredentials(runtime, options);
    const token = await signInWithPassword(runtime, convexConfig.convexUrl, {
      flow: "signUp",
      email: credentials.email,
      password: credentials.password,
      name: credentials.adminName,
      ...(credentials.workspaceName
        ? {
            workspaceName: credentials.workspaceName,
          }
        : {}),
    });

    const currentUser = await getCurrentUser(runtime, convexConfig.convexUrl, token);
    const workspace = findWorkspace(currentUser?.workspaces, currentUser?.user?.workspaceId);
    if (!workspace || !currentUser?.user?.workspaceId) {
      throw new SetupError({
        summary:
          "Sign-up succeeded, but the bootstrap could not resolve the newly created workspace.",
        why: "The local env propagation step needs the authenticated workspace identifier.",
        fix: [
          "Inspect auth:currentUser on the configured deployment, then rerun ./scripts/setup.sh once the account/workspace exists.",
        ],
      });
    }

    logSuccess(runtime, `Created bootstrap admin ${credentials.email}.`);
    logSuccess(runtime, `Resolved workspace ${workspace.name} (${workspace._id}).`);
    return {
      adminEmail: credentials.email,
      workspaceId: workspace._id,
      workspaceName: workspace.name,
    };
  }

  runtime.log(
    "This deployment already has users. The bootstrap will reuse an existing admin account by default."
  );
  const credentials = await collectSigninCredentials(runtime, options);
  const token = await signInWithPassword(runtime, convexConfig.convexUrl, {
    flow: "signIn",
    email: credentials.email,
    password: credentials.password,
  });
  const currentUser = await getCurrentUser(runtime, convexConfig.convexUrl, token);
  const selection = await chooseWorkspace(
    runtime,
    options,
    currentUser,
    convexConfig.convexUrl,
    token
  );
  const refreshedCurrentUser = await getCurrentUser(runtime, convexConfig.convexUrl, token);
  const workspace = findWorkspace(refreshedCurrentUser?.workspaces, selection.workspaceId);
  if (!workspace) {
    throw new SetupError({
      summary: "The selected workspace could not be resolved after authentication.",
      why: "Opencom cannot populate the local env files with a workspace that is not visible to the authenticated account.",
      fix: [
        "Choose a different workspace, or confirm the account has access to the workspace you selected.",
      ],
    });
  }

  logSuccess(
    runtime,
    `${selection.created ? "Created" : "Using"} workspace ${workspace.name} (${workspace._id}).`
  );
  return {
    adminEmail: credentials.email,
    workspaceId: workspace._id,
    workspaceName: workspace.name,
  };
}

async function writeManagedEnvFiles(runtime, context) {
  logSection(runtime, "5. Propagate Local Env Files Safely");

  for (const target of LOCAL_ENV_TARGETS) {
    const absolutePath = path.join(runtime.rootDir, target.relativePath);
    const desiredEntries = target.values(context);
    const existingContent = (await runtime.exists(absolutePath))
      ? await runtime.readFile(absolutePath, "utf8")
      : "";
    const nextContent = mergeEnvFileContent(existingContent, desiredEntries, target.managedComment);

    await runtime.writeFile(absolutePath, nextContent);
    const verifiedValues = await readEnvFile(absolutePath);

    for (const [key, expectedValue] of Object.entries(desiredEntries)) {
      if (String(verifiedValues[key] || "") !== String(expectedValue)) {
        throw new SetupError({
          summary: `Failed to verify ${key} in ${target.relativePath}.`,
          why: "The setup only succeeds if each local env file contains the same backend URL and workspace ID mapping it just resolved.",
          fix: [
            `Inspect ${target.relativePath} and remove any conflicting manual value for ${key}, then rerun the setup.`,
          ],
        });
      }
    }

    logSuccess(runtime, `Updated ${target.relativePath} without overwriting unrelated entries.`);
  }
}

async function evaluateOptionalProfiles(runtime) {
  const results = [];

  for (const profile of OPTIONAL_BACKEND_PROFILES) {
    const missingReasons = [];
    for (const check of profile.checks) {
      const values = [];
      for (const key of check.keys) {
        values.push(await getBackendEnvValue(runtime, key));
      }

      const passes = (() => {
        if (check.mode === "any") {
          return values.some((value) => value && (!check.validate || check.validate(value)));
        }
        return values.every((value) => value && (!check.validate || check.validate(value)));
      })();

      if (!passes) {
        missingReasons.push(check.message);
      }
    }

    results.push({
      ...profile,
      enabled: missingReasons.length === 0,
      missingReasons,
    });
  }

  return results;
}

function printSetupSummary(runtime, summary, optionalProfiles) {
  logSection(runtime, "6. Setup Summary");
  runtime.log(`Deployment: ${summary.deployment}`);
  runtime.log(`Backend URL: ${summary.convexUrl}`);
  runtime.log(`Workspace: ${summary.workspaceName} (${summary.workspaceId})`);
  runtime.log(`Bootstrap admin: ${summary.adminEmail}`);

  const disabledProfiles = optionalProfiles.filter((profile) => !profile.enabled);
  if (disabledProfiles.length > 0) {
    runtime.log("\nOptional features still disabled:");
    for (const profile of disabledProfiles) {
      runtime.log(`- ${profile.label}: ${profile.missingReasons.join("; ")}`);
    }
  }

  runtime.log("\nNext steps:");
  runtime.log("- pnpm dev:web");
  runtime.log("- pnpm dev:widget");
  runtime.log("- pnpm dev:landing");
  runtime.log("- pnpm dev:mobile");
}

async function maybeStartDevServers(runtime, options) {
  if (options.skipDev) {
    return;
  }

  const shouldStart = options.startDev
    ? true
    : options.nonInteractive
      ? false
      : await runtime.ui.confirm("Start the web and widget dev servers now?", false);

  if (!shouldStart) {
    return;
  }

  logSection(runtime, "Starting Dev Servers");
  runtime.log("Launching pnpm dev:web and pnpm dev:widget. Press Ctrl+C to stop both.");

  const webProcess = spawn("pnpm", ["dev:web"], {
    cwd: runtime.rootDir,
    stdio: "inherit",
    env: process.env,
  });
  const widgetProcess = spawn("pnpm", ["dev:widget"], {
    cwd: runtime.rootDir,
    stdio: "inherit",
    env: process.env,
  });

  const stopChildren = () => {
    if (!webProcess.killed) {
      webProcess.kill("SIGTERM");
    }
    if (!widgetProcess.killed) {
      widgetProcess.kill("SIGTERM");
    }
  };

  process.once("SIGINT", stopChildren);
  process.once("SIGTERM", stopChildren);

  await new Promise((resolve, reject) => {
    let settled = false;

    function finish(error) {
      if (settled) {
        return;
      }
      settled = true;
      process.removeListener("SIGINT", stopChildren);
      process.removeListener("SIGTERM", stopChildren);
      if (error) {
        reject(error);
        return;
      }
      resolve();
    }

    webProcess.on("error", finish);
    widgetProcess.on("error", finish);
    webProcess.on("exit", (code) => {
      if (code && code !== 0) {
        finish(new Error(`pnpm dev:web exited with code ${code}.`));
        return;
      }
      stopChildren();
      finish();
    });
    widgetProcess.on("exit", (code) => {
      if (code && code !== 0) {
        finish(new Error(`pnpm dev:widget exited with code ${code}.`));
        return;
      }
      stopChildren();
      finish();
    });
  });
}

async function runSetup(options, runtime = createRuntime()) {
  await installDependencies(runtime);
  const convexConfig = await ensureConvexDeployment(runtime, options);
  await ensureCoreBackendEnv(runtime);
  const workspace = await resolveWorkspace(runtime, options, convexConfig);
  await writeManagedEnvFiles(runtime, {
    convexUrl: convexConfig.convexUrl,
    workspaceId: workspace.workspaceId,
  });
  const optionalProfiles = await evaluateOptionalProfiles(runtime);
  printSetupSummary(
    runtime,
    {
      adminEmail: workspace.adminEmail,
      deployment: convexConfig.deployment,
      convexUrl: convexConfig.convexUrl,
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
    },
    optionalProfiles
  );
  await maybeStartDevServers(runtime, options);
}

async function resolveUpdateEnvInputs(runtime, options) {
  const convexEnv = await readEnvFile(path.join(runtime.rootDir, CONVEX_ENV_FILE));
  const webEnv = await readEnvFile(path.join(runtime.rootDir, "apps/web/.env.local"));
  const widgetEnv = await readEnvFile(path.join(runtime.rootDir, "apps/widget/.env.local"));
  const landingEnv = await readEnvFile(path.join(runtime.rootDir, "apps/landing/.env.local"));

  const convexUrl =
    options.convexUrl ||
    convexEnv.CONVEX_URL ||
    convexEnv.E2E_BACKEND_URL ||
    webEnv.NEXT_PUBLIC_CONVEX_URL ||
    webEnv.E2E_BACKEND_URL ||
    "";
  const workspaceId =
    options.workspaceId ||
    convexEnv.WORKSPACE_ID ||
    widgetEnv.VITE_WORKSPACE_ID ||
    landingEnv.NEXT_PUBLIC_WORKSPACE_ID ||
    "";

  const resolvedConvexUrl =
    convexUrl ||
    (options.nonInteractive ? "" : await runtime.ui.ask("Convex URL", { required: true }));
  const resolvedWorkspaceId =
    workspaceId ||
    (options.nonInteractive ? "" : await runtime.ui.ask("Workspace ID", { required: true }));

  if (!resolvedConvexUrl || !resolvedWorkspaceId) {
    throw new SetupError({
      summary: "Convex URL and workspace ID are both required to update local env files.",
      why: "The shared env propagation logic needs both values before it can write consistent local app configuration.",
      fix: ["Pass --url and --workspace, or rerun ./scripts/update-env.sh interactively."],
    });
  }

  return {
    convexUrl: sanitizeConvexUrl(resolvedConvexUrl),
    workspaceId: resolvedWorkspaceId.trim(),
  };
}

async function runUpdateEnv(options, runtime = createRuntime()) {
  logSection(runtime, "Update Local Env Files");
  const resolved = await resolveUpdateEnvInputs(runtime, options);
  await writeManagedEnvFiles(runtime, resolved);
  runtime.log("\nUpdated local env files successfully.");
  runtime.log(`Backend URL: ${resolved.convexUrl}`);
  runtime.log(`Workspace ID: ${resolved.workspaceId}`);
}

function printSetupUsage(runtime) {
  runtime.log("Usage: ./scripts/setup.sh [options]");
  runtime.log("");
  runtime.log("Options:");
  runtime.log("  --email <email>        Bootstrap or existing admin email");
  runtime.log("  --password <password>  Bootstrap or existing admin password");
  runtime.log("  --name <name>          Bootstrap admin display name");
  runtime.log("  --workspace <name>     Workspace name (new workspace only)");
  runtime.log("  --reconfigure          Force Convex CLI reconfiguration");
  runtime.log("  --create-workspace     Create a new workspace on an existing deployment");
  runtime.log("  --skip-dev             Never prompt to start dev servers");
  runtime.log("  --start-dev            Start web + widget dev servers after setup");
  runtime.log("  --non-interactive      Disable prompts (requires --email and --password)");
  runtime.log("  -h, --help             Show this help message");
}

function printUpdateEnvUsage(runtime) {
  runtime.log("Usage: ./scripts/update-env.sh [options]");
  runtime.log("");
  runtime.log("Options:");
  runtime.log("  --url <url>            Convex deployment URL");
  runtime.log("  --workspace <id>       Workspace ID");
  runtime.log("  --non-interactive      Disable prompts");
  runtime.log("  -h, --help             Show this help message");
}

function parseSetupArgs(argv) {
  const options = {
    adminEmail: "",
    adminPassword: "",
    adminName: "",
    workspaceName: "",
    createWorkspace: false,
    reconfigure: false,
    skipDev: false,
    startDev: false,
    nonInteractive: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--email":
        options.adminEmail = argv[index + 1] || "";
        index += 1;
        break;
      case "--password":
        options.adminPassword = argv[index + 1] || "";
        index += 1;
        break;
      case "--name":
        options.adminName = argv[index + 1] || "";
        index += 1;
        break;
      case "--workspace":
        options.workspaceName = argv[index + 1] || "";
        index += 1;
        break;
      case "--create-workspace":
        options.createWorkspace = true;
        break;
      case "--reconfigure":
        options.reconfigure = true;
        break;
      case "--skip-dev":
        options.skipDev = true;
        break;
      case "--start-dev":
        options.startDev = true;
        break;
      case "--non-interactive":
        options.nonInteractive = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new SetupError({
          summary: `Unknown option: ${argument}`,
          fix: ["Run ./scripts/setup.sh --help to see the supported flags."],
        });
    }
  }

  return options;
}

function parseUpdateEnvArgs(argv) {
  const options = {
    convexUrl: "",
    workspaceId: "",
    nonInteractive: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--url":
        options.convexUrl = argv[index + 1] || "";
        index += 1;
        break;
      case "--workspace":
        options.workspaceId = argv[index + 1] || "";
        index += 1;
        break;
      case "--non-interactive":
        options.nonInteractive = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new SetupError({
          summary: `Unknown option: ${argument}`,
          fix: ["Run ./scripts/update-env.sh --help to see the supported flags."],
        });
    }
  }

  return options;
}

function printSetupFailure(runtime, error) {
  runtime.error(`\n${colorize(COLORS.red, "Setup failed.", runtime)}`);
  runtime.error(`What went wrong: ${error.summary || toErrorMessage(error)}`);
  if (error.why) {
    runtime.error(`Why it matters: ${error.why}`);
  }
  if (error.fix && error.fix.length > 0) {
    runtime.error("How to fix it:");
    for (const step of error.fix) {
      runtime.error(`- ${step}`);
    }
  }
  if (error.details) {
    runtime.error("Backend/command details:");
    runtime.error(error.details);
  }
}

async function runSetupCli(argv, runtime = createRuntime()) {
  let options;
  try {
    options = parseSetupArgs(argv);
  } catch (error) {
    printSetupFailure(runtime, error);
    return 1;
  }

  if (options.help) {
    printSetupUsage(runtime);
    return 0;
  }

  try {
    await runSetup(options, runtime);
    return 0;
  } catch (error) {
    printSetupFailure(runtime, error);
    return 1;
  } finally {
    if (runtime.ui?.close) {
      await runtime.ui.close();
    }
  }
}

async function runUpdateEnvCli(argv, runtime = createRuntime()) {
  let options;
  try {
    options = parseUpdateEnvArgs(argv);
  } catch (error) {
    printSetupFailure(runtime, error);
    return 1;
  }

  if (options.help) {
    printUpdateEnvUsage(runtime);
    return 0;
  }

  try {
    await runUpdateEnv(options, runtime);
    return 0;
  } catch (error) {
    printSetupFailure(runtime, error);
    return 1;
  } finally {
    if (runtime.ui?.close) {
      await runtime.ui.close();
    }
  }
}

if (require.main === module) {
  runSetupCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = {
  CONVEX_ENV_FILE,
  SetupError,
  convexCloudToSiteUrl,
  createRuntime,
  generateJwtKeyPair,
  mergeEnvFileContent,
  parseEnvContent,
  readEnvFile,
  runSetup,
  runSetupCli,
  runUpdateEnv,
  runUpdateEnvCli,
  sanitizeConvexUrl,
};
