"use client";

const PUBLIC_WORKSPACE_STORAGE_KEY = "opencom_public_workspace";
const ACTIVE_WORKSPACE_STORAGE_KEY = "opencom_active_workspace";

type WorkspaceIdLike = string | null | undefined;

function buildHelpHref(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildHelpCenterHref(options?: {
  workspaceId?: WorkspaceIdLike;
  collectionSlug?: string | null;
}): string {
  const params = new URLSearchParams();
  if (options?.collectionSlug) {
    params.set("collection", options.collectionSlug);
  }
  if (options?.workspaceId) {
    params.set("workspaceId", options.workspaceId);
  }
  return buildHelpHref("/help", params);
}

export function buildHelpArticleHref(slug: string, workspaceId?: WorkspaceIdLike): string {
  const params = new URLSearchParams();
  if (workspaceId) {
    params.set("workspaceId", workspaceId);
  }
  return buildHelpHref(`/help/${slug}`, params);
}

function readStoredActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { _id?: string };
    return typeof parsed._id === "string" && parsed._id.length > 0 ? parsed._id : null;
  } catch {
    return null;
  }
}

export function readStoredPublicWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(PUBLIC_WORKSPACE_STORAGE_KEY);
  if (rawValue && rawValue.length > 0) {
    return rawValue;
  }

  return readStoredActiveWorkspaceId();
}

export function persistPublicWorkspaceId(workspaceId: WorkspaceIdLike): void {
  if (typeof window === "undefined" || !workspaceId) {
    return;
  }

  window.localStorage.setItem(PUBLIC_WORKSPACE_STORAGE_KEY, workspaceId);
}
