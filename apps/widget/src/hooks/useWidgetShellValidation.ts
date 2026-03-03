import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

type OriginValidationResult = {
  valid: boolean;
  reason?: string;
} | null;

export function useWidgetShellValidation(activeWorkspaceId: string | undefined) {
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [originError, setOriginError] = useState<string | null>(null);

  const isValidIdFormat = useMemo(
    () => Boolean(activeWorkspaceId && /^[a-z0-9]{32}$/.test(activeWorkspaceId)),
    [activeWorkspaceId]
  );

  const workspaceValidation = useQuery(
    api.workspaces.get,
    isValidIdFormat ? { id: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  const originValidation = useQuery(
    api.workspaces.validateOrigin,
    isValidIdFormat
      ? {
          workspaceId: activeWorkspaceId as Id<"workspaces">,
          origin: window.location.origin,
        }
      : "skip"
  ) as OriginValidationResult | undefined;

  useEffect(() => {
    if (!activeWorkspaceId) {
      setWorkspaceError("workspaceId is required");
      setOriginError(null);
      return;
    }

    if (!isValidIdFormat) {
      setWorkspaceError("Invalid workspace ID format");
      setOriginError(null);
      return;
    }

    if (workspaceValidation === null) {
      setWorkspaceError("Workspace not found");
      setOriginError(null);
      return;
    }

    setWorkspaceError(null);
    if (originValidation && !originValidation.valid) {
      setOriginError(originValidation.reason ?? "Origin not allowed");
      return;
    }

    setOriginError(null);
  }, [activeWorkspaceId, isValidIdFormat, workspaceValidation, originValidation]);

  return {
    isValidIdFormat,
    workspaceValidation,
    originValidation,
    workspaceError,
    originError,
  };
}
