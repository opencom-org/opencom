import type { Id } from "@opencom/convex/dataModel";

type WorkspaceId = Id<"workspaces">;

interface ResolveActiveWorkspaceIdArgs {
  storedWorkspaceId: WorkspaceId | null;
  userWorkspaceId: WorkspaceId | null;
  availableWorkspaceIds: WorkspaceId[];
}

export function resolveActiveWorkspaceId({
  storedWorkspaceId,
  userWorkspaceId,
  availableWorkspaceIds,
}: ResolveActiveWorkspaceIdArgs): WorkspaceId | null {
  if (availableWorkspaceIds.length === 0) {
    return null;
  }

  if (storedWorkspaceId && availableWorkspaceIds.includes(storedWorkspaceId)) {
    return storedWorkspaceId;
  }

  if (userWorkspaceId && availableWorkspaceIds.includes(userWorkspaceId)) {
    return userWorkspaceId;
  }

  return availableWorkspaceIds[0];
}

export function parseStoredWorkspaceId(storedValue: string | null): WorkspaceId | null {
  if (!storedValue) {
    return null;
  }

  const normalized = storedValue.trim();
  return normalized.length > 0 ? (normalized as WorkspaceId) : null;
}
