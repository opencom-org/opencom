import React from "react";
import { OpencomSurvey } from "./OpencomSurvey";
import { useSurveyDelivery } from "../hooks/useSurveyDelivery";

interface OpencomSurveyRuntimeProps {
  currentUrl?: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function OpencomSurveyRuntime({
  currentUrl = "",
  onComplete,
  onDismiss,
}: OpencomSurveyRuntimeProps) {
  const { survey, visitorId, completeSurvey, dismissSurvey } = useSurveyDelivery(currentUrl);

  if (!survey || !visitorId) {
    return null;
  }

  return (
    <OpencomSurvey
      survey={survey}
      onComplete={() => {
        completeSurvey();
        onComplete?.();
      }}
      onDismiss={() => {
        dismissSurvey();
        onDismiss?.();
      }}
    />
  );
}
