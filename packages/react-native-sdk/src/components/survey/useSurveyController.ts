import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { OpencomSDK } from "../../OpencomSDK";
import type { OpencomSurveyProps } from "./types";
import {
  beginSubmission,
  canProceedFromQuestion,
  completeSubmission,
  failSubmission,
  getInitialSurveyIndex,
  getNextSurveyAction,
  getPreviousSurveyIndex,
  getSurveyFlowState,
  normalizeSurveyAnswerValue,
  type SurveySubmissionState,
} from "./surveyFlow";
import { makeFunctionReference, type FunctionReference } from "convex/server";

function getMutationRef(name: string): FunctionReference<"mutation"> {
  return makeFunctionReference(name) as FunctionReference<"mutation">;
}

export function useSurveyController({ survey, onDismiss, onComplete }: OpencomSurveyProps) {
  const [currentIndex, setCurrentIndex] = useState(() => getInitialSurveyIndex(survey));
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submissionState, setSubmissionState] = useState<SurveySubmissionState>({
    isSubmitting: false,
    submitError: null,
    showThankYou: false,
  });

  const submitResponse = useMutation(getMutationRef("surveys:submitResponse"));
  const recordImpression = useMutation(getMutationRef("surveys:recordImpression"));

  const flowState = useMemo(() => getSurveyFlowState(survey, currentIndex), [survey, currentIndex]);
  const canProceed = canProceedFromQuestion(flowState.currentQuestion, answers);

  useEffect(() => {
    const state = OpencomSDK.getVisitorState();
    if (state.visitorId && state.sessionToken) {
      recordImpression({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        action: "shown",
      });
    }
  }, [recordImpression, survey._id]);

  const answerQuestion = (value: unknown) => {
    const question = flowState.currentQuestion;
    if (!question) {
      return;
    }
    setAnswers((previousAnswers) => ({ ...previousAnswers, [question.id]: value }));
  };

  const submitSurvey = async () => {
    setSubmissionState((currentState) => beginSubmission(currentState));
    const state = OpencomSDK.getVisitorState();

    if (!state.visitorId || !state.sessionToken) {
      setSubmissionState((currentState) => ({
        ...currentState,
        isSubmitting: false,
      }));
      return;
    }

    try {
      const answerArray = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value: normalizeSurveyAnswerValue(value),
      }));

      await submitResponse({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        answers: answerArray,
        isComplete: true,
      });

      await recordImpression({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        action: "completed",
      });

      const hasThankYouStep = Boolean(survey.thankYouStep);
      setSubmissionState((currentState) => completeSubmission(currentState, hasThankYouStep));
      if (!hasThankYouStep) {
        onComplete?.();
      }
    } catch (error) {
      console.error("Failed to submit survey:", error);
      setSubmissionState((currentState) => failSubmission(currentState, error));
    }
  };

  const handleNext = async () => {
    const state = OpencomSDK.getVisitorState();
    const nextAction = getNextSurveyAction(flowState, answers);

    if (nextAction.type === "noop") {
      return;
    }

    if (flowState.isIntroStep && state.visitorId && state.sessionToken) {
      recordImpression({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        action: "started",
      });
    }

    if (nextAction.type === "advance") {
      setCurrentIndex(nextAction.nextIndex);
      return;
    }

    await submitSurvey();
  };

  const handleBack = () => {
    const previousIndex = getPreviousSurveyIndex(currentIndex, Boolean(survey.introStep));
    if (previousIndex === null) {
      return;
    }
    setCurrentIndex(previousIndex);
  };

  const handleDismiss = async () => {
    const state = OpencomSDK.getVisitorState();
    if (state.visitorId && state.sessionToken) {
      await recordImpression({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        action: "dismissed",
      });
    }
    onDismiss?.();
  };

  return {
    ...flowState,
    answers,
    canProceed,
    isSubmitting: submissionState.isSubmitting,
    showThankYou: submissionState.showThankYou,
    submitError: submissionState.submitError,
    answerQuestion,
    handleNext,
    handleBack,
    handleDismiss,
  };
}
