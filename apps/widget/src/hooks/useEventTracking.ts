import { useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import {
  setIdentifyCallback,
  setTrackEventCallback,
  type UserIdentification,
  type EventProperties,
} from "../main";

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
  const identifyVisitor = useMutation(api.visitors.identify);
  const trackEventMutation = useMutation(api.events.track);

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
