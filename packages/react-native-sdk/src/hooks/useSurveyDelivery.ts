import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import {
  getVisitorState,
  selectSurveyForDelivery,
  type SurveyDeliveryCandidate,
} from "@opencom/sdk-core";
import type { Survey } from "../components/OpencomSurvey";
import { useOpencomContext } from "../components/OpencomProvider";
import { OpencomSDK } from "../OpencomSDK";

type SurveyData = Survey &
  SurveyDeliveryCandidate<Id<"surveys">> & {
    _id: Id<"surveys">;
  };

export function useSurveyDelivery(currentUrl: string = "") {
  const { workspaceId } = useOpencomContext();
  const state = getVisitorState();
  const visitorId = state.visitorId;
  const sessionId = state.sessionId;
  const sessionToken = state.sessionToken;

  const [timeOnPageSeconds, setTimeOnPageSeconds] = useState(0);
  const [firedEventName, setFiredEventName] = useState<string | undefined>(undefined);
  const [sessionShownSurveyIds, setSessionShownSurveyIds] = useState<Set<string>>(new Set());
  const [completedSurveyIds, setCompletedSurveyIds] = useState<Set<string>>(new Set());
  const [eligibilityUnavailable, setEligibilityUnavailable] = useState(false);
  const [displayedSurvey, setDisplayedSurvey] = useState<SurveyData | null>(null);

  const surveys = useQuery(
    api.surveys.getActiveSurveys,
    visitorId && workspaceId && sessionToken
      ? {
          workspaceId: workspaceId as Id<"workspaces">,
          visitorId,
          sessionToken,
        }
      : "skip"
  );

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const startTimer = () => {
      if (interval) return;
      interval = setInterval(() => {
        setTimeOnPageSeconds((prev) => prev + 1);
      }, 1000);
    };
    const stopTimer = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    if (AppState.currentState === "active") {
      startTimer();
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        startTimer();
      } else {
        stopTimer();
      }
    });

    return () => {
      stopTimer();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setTimeOnPageSeconds(0);
    setFiredEventName(undefined);
  }, [currentUrl]);

  useEffect(() => {
    return OpencomSDK.addSurveyTriggerListener((eventName) => {
      setFiredEventName(eventName);
    });
  }, []);

  useEffect(() => {
    if (!(visitorId && workspaceId && sessionToken)) {
      setEligibilityUnavailable(false);
      return;
    }
    if (surveys !== undefined) {
      setEligibilityUnavailable(false);
      return;
    }

    const timeout = setTimeout(() => {
      setEligibilityUnavailable(true);
      console.warn("[OpencomSDK] Survey eligibility unavailable, skipping runtime survey delivery");
    }, 5000);
    return () => clearTimeout(timeout);
  }, [visitorId, workspaceId, sessionToken, surveys]);

  const candidateSurvey = useMemo(() => {
    if (!surveys || eligibilityUnavailable) {
      return null;
    }
    return selectSurveyForDelivery(
      surveys as SurveyData[],
      {
        currentUrl,
        timeOnPageSeconds,
        firedEventName,
      },
      {
        sessionShownSurveyIds,
        completedSurveyIds,
      }
    ) as SurveyData | null;
  }, [
    surveys,
    eligibilityUnavailable,
    currentUrl,
    timeOnPageSeconds,
    firedEventName,
    sessionShownSurveyIds,
    completedSurveyIds,
  ]);

  useEffect(() => {
    if (displayedSurvey || !candidateSurvey) {
      return;
    }
    const surveyId = candidateSurvey._id.toString();
    setSessionShownSurveyIds((prev) => {
      if (prev.has(surveyId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(surveyId);
      return next;
    });
    setDisplayedSurvey(candidateSurvey);
  }, [displayedSurvey, candidateSurvey]);

  useEffect(() => {
    setDisplayedSurvey(null);
    setSessionShownSurveyIds(new Set());
    setCompletedSurveyIds(new Set());
    setFiredEventName(undefined);
    setTimeOnPageSeconds(0);
  }, [sessionId, visitorId, workspaceId]);

  const dismissSurvey = () => {
    setDisplayedSurvey(null);
    setFiredEventName(undefined);
  };

  const completeSurvey = () => {
    if (displayedSurvey) {
      const surveyId = displayedSurvey._id.toString();
      setCompletedSurveyIds((prev) => {
        const next = new Set(prev);
        next.add(surveyId);
        return next;
      });
    }
    setDisplayedSurvey(null);
    setFiredEventName(undefined);
  };

  return {
    survey: displayedSurvey,
    visitorId,
    sessionId,
    sessionToken,
    isLoading: surveys === undefined && !eligibilityUnavailable,
    dismissSurvey,
    completeSurvey,
  };
}
