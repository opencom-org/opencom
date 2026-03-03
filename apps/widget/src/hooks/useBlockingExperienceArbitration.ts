import { useEffect, useMemo, useState } from "react";

export type BlockingExperience = "tour" | "outbound_post" | "survey_large";

interface UseBlockingExperienceArbitrationOptions {
  hasTourBlockingCandidate: boolean;
  hasOutboundPostBlockingCandidate: boolean;
  hasOutboundPostBlockingActive: boolean;
  hasLargeSurveyBlockingCandidate: boolean;
  hasLargeSurveyBlockingActive: boolean;
  tourBlockingActive: boolean;
}

export function useBlockingExperienceArbitration({
  hasTourBlockingCandidate,
  hasOutboundPostBlockingCandidate,
  hasOutboundPostBlockingActive,
  hasLargeSurveyBlockingCandidate,
  hasLargeSurveyBlockingActive,
  tourBlockingActive,
}: UseBlockingExperienceArbitrationOptions) {
  const [activeBlockingExperience, setActiveBlockingExperience] = useState<BlockingExperience | null>(
    null
  );

  useEffect(() => {
    if (activeBlockingExperience !== null) {
      return;
    }

    // Priority order: tours, then outbound posts, then large surveys.
    if (hasTourBlockingCandidate) {
      setActiveBlockingExperience("tour");
      return;
    }

    if (hasOutboundPostBlockingCandidate) {
      setActiveBlockingExperience("outbound_post");
      return;
    }

    if (hasLargeSurveyBlockingCandidate) {
      setActiveBlockingExperience("survey_large");
    }
  }, [
    activeBlockingExperience,
    hasTourBlockingCandidate,
    hasOutboundPostBlockingCandidate,
    hasLargeSurveyBlockingCandidate,
  ]);

  useEffect(() => {
    if (activeBlockingExperience === null) {
      return;
    }

    if (activeBlockingExperience === "tour") {
      if (tourBlockingActive || hasTourBlockingCandidate) {
        return;
      }
      setActiveBlockingExperience(null);
      return;
    }

    if (activeBlockingExperience === "outbound_post") {
      if (hasOutboundPostBlockingActive || hasOutboundPostBlockingCandidate) {
        return;
      }
      setActiveBlockingExperience(null);
      return;
    }

    if (hasLargeSurveyBlockingActive || hasLargeSurveyBlockingCandidate) {
      return;
    }
    setActiveBlockingExperience(null);
  }, [
    activeBlockingExperience,
    tourBlockingActive,
    hasTourBlockingCandidate,
    hasOutboundPostBlockingActive,
    hasOutboundPostBlockingCandidate,
    hasLargeSurveyBlockingActive,
    hasLargeSurveyBlockingCandidate,
  ]);

  const allowTourBlocking = activeBlockingExperience === "tour";
  const allowOutboundPostBlocking = activeBlockingExperience === "outbound_post";
  const allowLargeSurveyBlocking = activeBlockingExperience === "survey_large";

  const hasAnyPendingBlockingCandidate = useMemo(
    () =>
      hasTourBlockingCandidate || hasOutboundPostBlockingCandidate || hasLargeSurveyBlockingCandidate,
    [hasTourBlockingCandidate, hasOutboundPostBlockingCandidate, hasLargeSurveyBlockingCandidate]
  );

  return {
    activeBlockingExperience,
    setActiveBlockingExperience,
    allowTourBlocking,
    allowOutboundPostBlocking,
    allowLargeSurveyBlocking,
    hasAnyPendingBlockingCandidate,
  };
}
