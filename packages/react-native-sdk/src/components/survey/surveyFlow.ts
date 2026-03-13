import type { Survey, SurveyQuestion } from "./types";

export type SurveySubmissionValue = string | number | boolean | string[] | number[] | null;

export interface SurveyFlowState {
  currentIndex: number;
  totalSteps: number;
  isIntroStep: boolean;
  isQuestionStep: boolean;
  currentQuestion: SurveyQuestion | null;
}

export interface SurveySubmissionState {
  isSubmitting: boolean;
  submitError: string | null;
  showThankYou: boolean;
}

export type NextSurveyAction =
  | { type: "advance"; nextIndex: number }
  | { type: "submit" }
  | { type: "noop" };

export function getInitialSurveyIndex(survey: Pick<Survey, "introStep">): number {
  return survey.introStep ? -1 : 0;
}

export function getSurveyFlowState(survey: Survey, currentIndex: number): SurveyFlowState {
  const totalSteps = survey.questions.length;
  const isIntroStep = currentIndex === -1;
  const isQuestionStep = currentIndex >= 0 && currentIndex < totalSteps;
  const currentQuestion = isQuestionStep ? survey.questions[currentIndex] : null;

  return {
    currentIndex,
    totalSteps,
    isIntroStep,
    isQuestionStep,
    currentQuestion,
  };
}

export function canProceedFromQuestion(
  question: SurveyQuestion | null,
  answers: Record<string, unknown>
): boolean {
  if (!question?.required) {
    return true;
  }
  return answers[question.id] !== undefined;
}

export function getNextSurveyAction(
  state: SurveyFlowState,
  answers: Record<string, unknown>
): NextSurveyAction {
  if (state.isIntroStep) {
    return { type: "advance", nextIndex: 0 };
  }

  if (state.currentQuestion?.required && answers[state.currentQuestion.id] === undefined) {
    return { type: "noop" };
  }

  if (state.currentIndex < state.totalSteps - 1) {
    return { type: "advance", nextIndex: state.currentIndex + 1 };
  }

  return { type: "submit" };
}

export function getPreviousSurveyIndex(
  currentIndex: number,
  hasIntroStep: boolean
): number | null {
  const minimumIndex = hasIntroStep ? -1 : 0;
  if (currentIndex <= minimumIndex) {
    return null;
  }
  return currentIndex - 1;
}

function isSurveyAnswerPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function normalizeSurveyAnswerValue(value: unknown): SurveySubmissionValue {
  if (isSurveyAnswerPrimitive(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === "string")) {
      return value;
    }
    if (value.every((entry) => typeof entry === "number")) {
      return value;
    }
  }

  return null;
}

export function beginSubmission(
  currentState: SurveySubmissionState
): SurveySubmissionState {
  return {
    ...currentState,
    isSubmitting: true,
    submitError: null,
  };
}

export function completeSubmission(
  currentState: SurveySubmissionState,
  hasThankYouStep: boolean
): SurveySubmissionState {
  return {
    ...currentState,
    isSubmitting: false,
    submitError: null,
    showThankYou: hasThankYouStep,
  };
}

export function failSubmission(
  currentState: SurveySubmissionState,
  error: unknown
): SurveySubmissionState {
  const message = error instanceof Error ? error.message : "Failed to submit survey";
  return {
    ...currentState,
    isSubmitting: false,
    submitError: message,
  };
}
