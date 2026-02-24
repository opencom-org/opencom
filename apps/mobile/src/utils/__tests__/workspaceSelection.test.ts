import type { Id } from "@opencom/convex/dataModel";
import { describe, expect, it } from "vitest";
import { parseStoredWorkspaceId, resolveActiveWorkspaceId } from "../workspaceSelection";

const WORKSPACE_A = "workspace_a" as Id<"workspaces">;
const WORKSPACE_B = "workspace_b" as Id<"workspaces">;
const WORKSPACE_C = "workspace_c" as Id<"workspaces">;

describe("resolveActiveWorkspaceId", () => {
  it("uses stored workspace when it is still available", () => {
    const resolved = resolveActiveWorkspaceId({
      storedWorkspaceId: WORKSPACE_B,
      userWorkspaceId: WORKSPACE_A,
      availableWorkspaceIds: [WORKSPACE_A, WORKSPACE_B],
    });

    expect(resolved).toBe(WORKSPACE_B);
  });

  it("falls back to user workspace when stored workspace is invalid", () => {
    const resolved = resolveActiveWorkspaceId({
      storedWorkspaceId: WORKSPACE_C,
      userWorkspaceId: WORKSPACE_A,
      availableWorkspaceIds: [WORKSPACE_A, WORKSPACE_B],
    });

    expect(resolved).toBe(WORKSPACE_A);
  });

  it("falls back to first membership when neither stored nor user workspace is available", () => {
    const resolved = resolveActiveWorkspaceId({
      storedWorkspaceId: WORKSPACE_C,
      userWorkspaceId: WORKSPACE_C,
      availableWorkspaceIds: [WORKSPACE_A, WORKSPACE_B],
    });

    expect(resolved).toBe(WORKSPACE_A);
  });

  it("returns null when no workspaces are available", () => {
    const resolved = resolveActiveWorkspaceId({
      storedWorkspaceId: WORKSPACE_A,
      userWorkspaceId: WORKSPACE_B,
      availableWorkspaceIds: [],
    });

    expect(resolved).toBeNull();
  });
});

describe("parseStoredWorkspaceId", () => {
  it("returns null for empty values", () => {
    expect(parseStoredWorkspaceId(null)).toBeNull();
    expect(parseStoredWorkspaceId("")).toBeNull();
    expect(parseStoredWorkspaceId("   ")).toBeNull();
  });

  it("returns trimmed workspace id for non-empty values", () => {
    expect(parseStoredWorkspaceId(`  ${WORKSPACE_A}  `)).toBe(WORKSPACE_A);
  });
});
