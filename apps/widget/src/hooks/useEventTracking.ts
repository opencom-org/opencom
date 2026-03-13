import { useCallback, useEffect } from "react";
import type { Id } from "@opencom/convex/dataModel";
import {
  setIdentifyCallback,
  setTrackEventCallback,
  type UserIdentification,
  type EventProperties,
} from "../main";
import { useWidgetMutation, widgetMutationRef } from "../lib/convex/hooks";

interface UseEventTrackingOptions {
  visitorId: Id<"visitors"> | null;
  activeWorkspaceId: string | undefined;
  sessionId: string;
  sessionTokenRef: React.MutableRefObject<string | null>;
  userInfo: UserIdentification | undefined;
  setUserInfo: React.Dispatch<React.SetStateAction<UserIdentification | undefined>>;
  onTrackEventName?: (name: string) => void;
}

type WidgetEventPropertyValue = string | number | boolean | null | Array<string | number>;
type WidgetEventProperties = Record<string, WidgetEventPropertyValue>;

const identifyVisitorMutationRef = widgetMutationRef<
  {
    visitorId: Id<"visitors">;
    sessionToken?: string;
    email?: string;
    name?: string;
    externalUserId?: string;
    userHash?: string;
    customAttributes?: Record<string, unknown>;
    origin: string;
  },
  null
>("visitors:identify");

const trackEventMutationRef = widgetMutationRef<
  {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    sessionToken?: string;
    name: string;
    properties?: WidgetEventProperties;
    url: string;
    sessionId: string;
  },
  null
>("events:track");

function normalizeEventProperties(
  properties: EventProperties | undefined
): WidgetEventProperties | undefined {
  if (!properties) {
    return undefined;
  }

  const normalized: WidgetEventProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      normalized[key] = value;
      continue;
    }

    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string" || typeof item === "number")
    ) {
      normalized[key] = value;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function useEventTracking({
  visitorId,
  activeWorkspaceId,
  sessionId,
  sessionTokenRef,
  userInfo: _userInfo,
  setUserInfo,
  onTrackEventName,
}: UseEventTrackingOptions) {
  const identifyVisitor = useWidgetMutation(identifyVisitorMutationRef);
  const trackEventMutation = useWidgetMutation(trackEventMutationRef);

  // Identification callback
  const handleIdentify = useCallback(
    (user: UserIdentification) => {
      setUserInfo(user);
      if (visitorId) {
        identifyVisitor({
          visitorId,
          sessionToken: sessionTokenRef.current ?? undefined,
          email: user.email,
          name: user.name,
          externalUserId: user.userId,
          userHash: user.userHash,
          customAttributes: {
            ...(user.company && { company: user.company }),
            ...user.customAttributes,
          },
          origin: window.location.origin,
        }).catch(console.error);
      }
    },
    [visitorId, identifyVisitor, sessionTokenRef, setUserInfo]
  );

  useEffect(() => {
    setIdentifyCallback(handleIdentify);
  }, [handleIdentify]);

  // Event tracking callback
  const handleTrackEvent = useCallback(
    (name: string, properties?: EventProperties) => {
      if (!visitorId || !activeWorkspaceId) {
        console.warn("[Opencom Widget] Cannot track event - visitor not initialized");
        return;
      }
      onTrackEventName?.(name);
      trackEventMutation({
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        name,
        properties: normalizeEventProperties(properties),
        url: window.location.href,
        sessionId,
      }).catch(console.error);
    },
    [visitorId, activeWorkspaceId, sessionId, trackEventMutation, sessionTokenRef, onTrackEventName]
  );

  useEffect(() => {
    setTrackEventCallback(handleTrackEvent);
  }, [handleTrackEvent]);

  return {
    handleIdentify,
    handleTrackEvent,
    identifyVisitor,
  };
}
