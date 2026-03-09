#!/usr/bin/env node

const { spawn } = require("child_process");

const args = process.argv.slice(2);

let timeoutMs = 60000;
let cwd = process.cwd();
let commandStartIndex = -1;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--timeout-ms") {
    const value = Number(args[i + 1]);
    if (!Number.isFinite(value) || value <= 0) {
      console.error("Invalid --timeout-ms value");
      process.exit(2);
    }
    timeoutMs = value;
    i += 1;
    continue;
  }

  if (arg === "--cwd") {
    const value = args[i + 1];
    if (!value) {
      console.error("Missing value for --cwd");
      process.exit(2);
    }
    cwd = value;
    i += 1;
    continue;
  }

  if (arg === "--") {
    commandStartIndex = i + 1;
    break;
  }
}

if (commandStartIndex === -1) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--timeout-ms" || arg === "--cwd") {
      i += 1;
      continue;
    }

    commandStartIndex = i;
    break;
  }
}

if (commandStartIndex === -1 || commandStartIndex >= args.length) {
  console.error(
    "Usage: node scripts/run-with-timeout.js [--timeout-ms 60000] [--cwd path] [--] <command> [args...]"
  );
  process.exit(2);
}

const command = args[commandStartIndex];
const commandArgs = args.slice(commandStartIndex + 1);

const child = spawn(command, commandArgs, {
  cwd,
  stdio: "inherit",
  shell: false,
  detached: process.platform !== "win32",
});

let timedOut = false;

const timeout = setTimeout(() => {
  timedOut = true;
  console.error(`\n[run-with-timeout] Timed out after ${timeoutMs}ms: ${command} ${commandArgs.join(" ")}`);

  if (process.platform === "win32") {
    child.kill("SIGKILL");
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}, timeoutMs);

child.on("error", (error) => {
  clearTimeout(timeout);
  console.error(`[run-with-timeout] Failed to start command: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  clearTimeout(timeout);

  if (timedOut) {
    process.exit(124);
  }

  if (signal) {
    console.error(`[run-with-timeout] Command terminated by signal: ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
