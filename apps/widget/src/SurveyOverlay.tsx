import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { normalizeSurveyAnswerValue } from "./surveyOverlay/answers";
import {
  LargeFormatContainer,
  SmallFormatContainer,
  SurveyQuestionRenderer,
} from "./surveyOverlay/components";
import type { SurveyOverlayProps } from "./surveyOverlay/types";

export function SurveyOverlay({
  survey,
  visitorId,
  sessionId,
  sessionToken,
  onComplete,
  onDismiss,
  primaryColor = "#792cd4",
}: SurveyOverlayProps) {
  const [currentStep, setCurrentStep] = useState(survey.introStep ? -1 : 0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const submitResponse = useMutation(api.surveys.submitResponse);
  const recordImpression = useMutation(api.surveys.recordImpression);

  const totalSteps = survey.questions.length;
  const isIntroStep = currentStep === -1;
  const isQuestionStep = currentStep >= 0 && currentStep < totalSteps;
  const currentQuestion = isQuestionStep ? survey.questions[currentStep] : null;

  useEffect(() => {
    void recordImpression({
      surveyId: survey._id,
      visitorId,
      sessionId,
      sessionToken,
      action: "shown",
    });
  }, [recordImpression, survey._id, visitorId, sessionId, sessionToken]);

  const handleAnswer = (value: unknown) => {
    if (!currentQuestion) return;
    setAnswers({ ...answers, [currentQuestion.id]: value });
  };

  const handleNext = async () => {
    if (isIntroStep) {
      recordImpression({
        surveyId: survey._id,
        visitorId,
        sessionId,
        sessionToken,
        action: "started",
      });
      setCurrentStep(0);
      return;
    }

    if (currentQuestion?.required && answers[currentQuestion.id] === undefined) {
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > (survey.introStep ? -1 : 0)) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const answerArray = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value: normalizeSurveyAnswerValue(value),
      }));

      await submitResponse({
        surveyId: survey._id,
        visitorId,
        sessionId,
        sessionToken,
        answers: answerArray,
        isComplete: true,
      });

      await recordImpression({
        surveyId: survey._id,
        visitorId,
        sessionId,
        sessionToken,
        action: "completed",
      });

      if (survey.thankYouStep) {
        setShowThankYou(true);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to submit survey:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    await recordImpression({
      surveyId: survey._id,
      visitorId,
      sessionId,
      sessionToken,
      action: "dismissed",
    });
    onDismiss();
  };

  const canProceed = !currentQuestion?.required || answers[currentQuestion.id] !== undefined;

  if (showThankYou && survey.thankYouStep) {
    return survey.format === "small" ? (
      <SmallFormatContainer onDismiss={onComplete} showDismiss={false}>
        <div className="oc-survey-thank-you">
          <h3 className="oc-survey-title">{survey.thankYouStep.title}</h3>
          {survey.thankYouStep.description && (
            <p className="oc-survey-description">{survey.thankYouStep.description}</p>
          )}
          <button
            className="oc-survey-button oc-survey-button-primary"
            onClick={onComplete}
            style={{ backgroundColor: primaryColor }}
          >
            {survey.thankYouStep.buttonText || "Done"}
          </button>
        </div>
      </SmallFormatContainer>
    ) : (
      <LargeFormatContainer onDismiss={onComplete} showDismiss={false}>
        <div className="oc-survey-thank-you">
          <h3 className="oc-survey-title">{survey.thankYouStep.title}</h3>
          {survey.thankYouStep.description && (
            <p className="oc-survey-description">{survey.thankYouStep.description}</p>
          )}
          <button
            className="oc-survey-button oc-survey-button-primary"
            onClick={onComplete}
            style={{ backgroundColor: primaryColor }}
          >
            {survey.thankYouStep.buttonText || "Done"}
          </button>
        </div>
      </LargeFormatContainer>
    );
  }

  const content = (
    <>
      {survey.showProgressBar && survey.format === "large" && isQuestionStep && (
        <div className="oc-survey-progress">
          <div
            className="oc-survey-progress-bar"
            style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
              backgroundColor: primaryColor,
            }}
          />
        </div>
      )}

      {isIntroStep && survey.introStep && (
        <div className="oc-survey-intro">
          <h3 className="oc-survey-title">{survey.introStep.title}</h3>
          {survey.introStep.description && (
            <p className="oc-survey-description">{survey.introStep.description}</p>
          )}
          <button
            className="oc-survey-button oc-survey-button-primary"
            onClick={handleNext}
            style={{ backgroundColor: primaryColor }}
          >
            {survey.introStep.buttonText || "Start"}
          </button>
        </div>
      )}

      {isQuestionStep && currentQuestion && (
        <div className="oc-survey-question">
          <div className="oc-survey-question-header">
            <h3 className="oc-survey-question-title">
              {currentQuestion.title}
              {currentQuestion.required && <span className="oc-survey-required">*</span>}
            </h3>
            {currentQuestion.description && (
              <p className="oc-survey-question-description">{currentQuestion.description}</p>
            )}
          </div>

          <div className="oc-survey-question-content">
            <SurveyQuestionRenderer
              question={currentQuestion}
              value={answers[currentQuestion.id]}
              onChange={handleAnswer}
              primaryColor={primaryColor}
            />
          </div>

          <div className="oc-survey-actions">
            {currentStep > 0 && (
              <button className="oc-survey-button oc-survey-button-secondary" onClick={handleBack}>
                Back
              </button>
            )}
            <button
              className="oc-survey-button oc-survey-button-primary"
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              style={{ backgroundColor: canProceed ? primaryColor : "#9ca3af" }}
            >
              {isSubmitting ? "..." : currentStep === totalSteps - 1 ? "Submit" : "Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return survey.format === "small" ? (
    <SmallFormatContainer onDismiss={handleDismiss} showDismiss={survey.showDismissButton}>
      {content}
    </SmallFormatContainer>
  ) : (
    <LargeFormatContainer onDismiss={handleDismiss} showDismiss={survey.showDismissButton}>
      {content}
    </LargeFormatContainer>
  );
}
