import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import type { Id } from "@opencom/convex/dataModel";

type WorkspaceRecord = {
  _id: Id<"workspaces">;
} | null;

type OriginValidationResult = {
  valid: boolean;
  reason?: string;
} | null;

const workspaceGetQueryRef = makeFunctionReference<
  "query",
  { id: Id<"workspaces"> },
  WorkspaceRecord
>("workspaces:get");

const workspaceValidateOriginQueryRef = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces">; origin: string },
  OriginValidationResult
>("workspaces:validateOrigin");

export function useWidgetShellValidation(activeWorkspaceId: string | undefined) {
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [originError, setOriginError] = useState<string | null>(null);

  const isValidIdFormat = useMemo(
    () => Boolean(activeWorkspaceId && /^[a-z0-9]{32}$/.test(activeWorkspaceId)),
    [activeWorkspaceId]
  );

  const workspaceValidation = useQuery(
    workspaceGetQueryRef,
    isValidIdFormat ? { id: activeWorkspaceId as Id<"workspaces"> } : "skip"
  ) as WorkspaceRecord | undefined;

  const originValidation = useQuery(
    workspaceValidateOriginQueryRef,
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
