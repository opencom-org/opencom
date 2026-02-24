import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { generateSessionId } from "../utils/session";
import { detectDevice } from "../utils/device";
import type { UserIdentification } from "../main";

interface UseWidgetSessionOptions {
  activeWorkspaceId: string | undefined;
  userInfo: UserIdentification | undefined;
  workspaceValidation: unknown;
  isOpen: boolean;
  onboardingVerificationToken?: string;
  verificationToken?: string;
  clientVersion?: string;
  clientIdentifier?: string;
}

export function useWidgetSession({
  activeWorkspaceId,
  userInfo,
  workspaceValidation,
  isOpen,
  onboardingVerificationToken,
  verificationToken,
  clientVersion,
  clientIdentifier,
}: UseWidgetSessionOptions) {
  const [sessionId] = useState(generateSessionId);
  const [visitorId, setVisitorId] = useState<Id<"visitors"> | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const sessionExpiresAtRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializingSessionRef = useRef(false);
  const visitorIdRef = useRef<Id<"visitors"> | null>(null);
  visitorIdRef.current = visitorId;

  const bootSession = useMutation(api.widgetSessions.boot);
  const refreshSession = useMutation(api.widgetSessions.refresh);
  const heartbeatMutation = useMutation(api.visitors.heartbeat);
  const recordHostedOnboardingVerificationEvent = useMutation(
    api.workspaces.recordHostedOnboardingVerificationEvent
  );
  const lastRecordedVerificationTokenRef = useRef<string | null>(null);
  const resolvedVerificationToken = onboardingVerificationToken ?? verificationToken;

  // Schedule a session token refresh when <25% lifetime remains
  const scheduleTokenRefresh = useCallback(
    (token: string, expiresAt: number) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      const lifetime = expiresAt - Date.now();
      const refreshAt = lifetime * 0.75; // Refresh when 75% of lifetime has elapsed (25% remaining)
      if (refreshAt <= 0) return;

      refreshTimerRef.current = setTimeout(async () => {
        try {
          const result = await refreshSession({ sessionToken: token });
          setSessionToken(result.sessionToken);
          sessionTokenRef.current = result.sessionToken;
          sessionExpiresAtRef.current = result.expiresAt;
          scheduleTokenRefresh(result.sessionToken, result.expiresAt);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("expired") || msg.includes("Invalid")) {
            // Session expired during refresh — trigger re-boot
            setSessionToken(null);
            sessionTokenRef.current = null;
            sessionExpiresAtRef.current = null;
            setVisitorId(null);
          }
          console.error("[Opencom Widget] Session refresh failed:", error);
        }
      }, refreshAt);
    },
    [refreshSession]
  );

  // Cleanup refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Boot session as soon as workspace context is ready.
  // This allows outbounds/surveys/tooltips to appear even when the launcher is closed.
  useEffect(() => {
    async function initChat() {
      try {
        // Require workspaceId - don't fall back to default
        if (!activeWorkspaceId) {
          return;
        }

        // Verify workspace exists before proceeding
        if (workspaceValidation === undefined) {
          return; // Still loading
        }
        if (workspaceValidation === null) {
          return; // Workspace not found - error already set
        }

        const workspaceId = activeWorkspaceId as Id<"workspaces">;

        const device = detectDevice();

        // Use boot flow to get a signed session token
        const bootResult = await bootSession({
          workspaceId,
          sessionId,
          email: userInfo?.email,
          name: userInfo?.name,
          externalUserId: userInfo?.userId,
          userHash: userInfo?.userHash,
          device,
          referrer: document.referrer || undefined,
          currentUrl: window.location.href,
          customAttributes: {
            ...(userInfo?.company && { company: userInfo.company }),
            ...userInfo?.customAttributes,
          },
          origin: window.location.origin,
          clientType: "web_widget",
          clientVersion,
          clientIdentifier,
        });
        if (!bootResult?.visitor) return;

        setVisitorId(bootResult.visitor._id);
        setSessionToken(bootResult.sessionToken);
        sessionTokenRef.current = bootResult.sessionToken;
        sessionExpiresAtRef.current = bootResult.expiresAt;

        if (resolvedVerificationToken) {
          const verificationKey = `${workspaceId}:${resolvedVerificationToken}`;
          if (lastRecordedVerificationTokenRef.current !== verificationKey) {
            try {
              const verificationResult = await recordHostedOnboardingVerificationEvent({
                workspaceId,
                token: resolvedVerificationToken,
                origin: window.location.origin,
                currentUrl: window.location.href,
              });

              if (verificationResult.accepted) {
                lastRecordedVerificationTokenRef.current = verificationKey;
              }
            } catch (verificationError) {
              console.warn(
                "[Opencom Widget] Could not record onboarding verification event:",
                verificationError
              );
            }
          }
        }

        // Schedule automatic token refresh
        scheduleTokenRefresh(bootResult.sessionToken, bootResult.expiresAt);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (
          msg.includes("Origin validation failed") ||
          msg.includes("Identity verification failed")
        ) {
          // These errors are surfaced via workspace/origin validation
        } else {
          console.error("Failed to initialize chat:", error);
        }
      }
    }

    if (!visitorId && !initializingSessionRef.current) {
      initializingSessionRef.current = true;
      initChat().finally(() => {
        initializingSessionRef.current = false;
      });
    }
  }, [
    visitorId,
    sessionId,
    userInfo,
    activeWorkspaceId,
    workspaceValidation,
    onboardingVerificationToken,
    verificationToken,
    resolvedVerificationToken,
    clientVersion,
    clientIdentifier,
    bootSession,
    recordHostedOnboardingVerificationEvent,
    scheduleTokenRefresh,
  ]);

  // Heartbeat for presence tracking
  useEffect(() => {
    if (!visitorId || !isOpen) return;

    // Send initial heartbeat
    heartbeatMutation({
      visitorId,
      sessionToken: sessionTokenRef.current ?? undefined,
      origin: window.location.origin,
    }).catch(console.error);

    // Send heartbeat every 30 seconds
    const interval = setInterval(() => {
      heartbeatMutation({
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        origin: window.location.origin,
      }).catch(console.error);
    }, 30000);

    // Send heartbeat on window focus
    const handleFocus = () => {
      heartbeatMutation({
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        origin: window.location.origin,
      }).catch(console.error);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [visitorId, isOpen, heartbeatMutation]);

  return {
    sessionId,
    visitorId,
    setVisitorId,
    visitorIdRef,
    sessionToken,
    sessionTokenRef,
  };
}
