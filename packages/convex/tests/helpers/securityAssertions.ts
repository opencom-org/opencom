import { expect } from "vitest";

const AUTH_ERROR_PATTERNS = [/Not authenticated/i, /Unauthorized/i, /Session token required/i];

const AUTHZ_ERROR_PATTERNS = [
  /Not a member of this workspace/i,
  /Permission denied/i,
  /Not authorized/i,
];

const OWNERSHIP_ERROR_PATTERNS = [
  /Not authorized for requested visitor/i,
  /Session token does not match workspace/i,
  /Not authorized\b/i,
  /Not authorized to/i,
  /Visitor not found in workspace/i,
];

async function expectOneOfErrors(operation: Promise<unknown>, patterns: RegExp[]): Promise<void> {
  try {
    await operation;
    throw new Error("Expected operation to fail with a security error");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const matched = patterns.some((pattern) => pattern.test(message));
    expect(
      matched,
      `Expected one of [${patterns.map((p) => p.source).join(", ")}], got: ${message}`
    ).toBe(true);
  }
}

export async function expectAuthError(operation: Promise<unknown>): Promise<void> {
  await expectOneOfErrors(operation, AUTH_ERROR_PATTERNS);
}

export async function expectAuthorizationError(operation: Promise<unknown>): Promise<void> {
  await expectOneOfErrors(operation, AUTHZ_ERROR_PATTERNS);
}

export async function expectOwnershipError(operation: Promise<unknown>): Promise<void> {
  await expectOneOfErrors(operation, OWNERSHIP_ERROR_PATTERNS);
}
