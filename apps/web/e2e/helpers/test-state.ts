/**
 * Test State Helper
 * Provides utilities to read the test state saved by global setup.
 */

import * as fs from "fs";
import * as path from "path";

const STATE_FILE = path.join(__dirname, "..", ".e2e-state.json");
const AUTH_STATE_FILE = path.join(__dirname, "..", ".auth-state.json");

export interface E2ETestState {
  testRunId: number;
  workerIndex?: number;
  email: string;
  workspaceName: string;
  workspaceId?: string;
  userId?: string;
  authStoragePath: string;
  stateFilePath?: string;
}

function readJson<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export function getTestStatePath(): string {
  return process.env.E2E_WORKER_STATE_PATH || STATE_FILE;
}

export function getAuthStatePath(): string {
  return process.env.E2E_WORKER_AUTH_STATE_PATH || AUTH_STATE_FILE;
}

export function readTestStateFromPath(filePath: string): E2ETestState | null {
  return readJson<E2ETestState>(filePath);
}

/**
 * Gets the test state saved by global setup.
 */
export function getTestState(): E2ETestState | null {
  return readTestStateFromPath(getTestStatePath());
}
