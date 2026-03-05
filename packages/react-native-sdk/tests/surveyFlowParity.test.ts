import { describe, expect, it } from "vitest";
import {
  beginSubmission,
  canProceedFromQuestion,
  completeSubmission,
  failSubmission,
  getInitialSurveyIndex,
  getNextSurveyAction,
  getSurveyFlowState,
  normalizeSurveyAnswerValue,
} from "../src/components/survey/surveyFlow";
import type { Survey } from "../src/components/survey/types";

const baseSurvey: Survey = {
  _id: "survey_1" as any,
  name: "Test survey",
  format: "small",
  introStep: {
    title: "Welcome",
  },
  questions: [
    {
      id: "q1",
      type: "short_text",
      title: "Required question",
      required: true,
    },
    {
      id: "q2",
      type: "nps",
      title: "Optional follow-up",
      required: false,
    },
  ],
};

describe("survey flow parity", () => {
  it("keeps intro and question step transition behavior", () => {
    const initialIndex = getInitialSurveyIndex(baseSurvey);
    expect(initialIndex).toBe(-1);

    const introState = getSurveyFlowState(baseSurvey, initialIndex);
    expect(getNextSurveyAction(introState, {})).toEqual({ type: "advance", nextIndex: 0 });

    const questionState = getSurveyFlowState(baseSurvey, 0);
    expect(canProceedFromQuestion(questionState.currentQuestion, {})).toBe(false);
    expect(getNextSurveyAction(questionState, {})).toEqual({ type: "noop" });

    const answered = { q1: "Yes" };
    expect(canProceedFromQuestion(questionState.currentQuestion, answered)).toBe(true);
    expect(getNextSurveyAction(questionState, answered)).toEqual({ type: "advance", nextIndex: 1 });

    const finalState = getSurveyFlowState(baseSurvey, 1);
    expect(getNextSurveyAction(finalState, answered)).toEqual({ type: "submit" });
  });

  it("keeps answer normalization behavior", () => {
    expect(normalizeSurveyAnswerValue("text")).toBe("text");
    expect(normalizeSurveyAnswerValue(4)).toBe(4);
    expect(normalizeSurveyAnswerValue(true)).toBe(true);
    expect(normalizeSurveyAnswerValue(["a", "b"])).toEqual(["a", "b"]);
    expect(normalizeSurveyAnswerValue([1, 2])).toEqual([1, 2]);
    expect(normalizeSurveyAnswerValue({ nested: true })).toBeNull();
  });

  it("keeps submission completion and retry/error state behavior", () => {
    const started = beginSubmission({
      isSubmitting: false,
      submitError: "previous error",
      showThankYou: false,
    });
    expect(started).toEqual({
      isSubmitting: true,
      submitError: null,
      showThankYou: false,
    });

    const failed = failSubmission(started, new Error("Network unavailable"));
    expect(failed).toEqual({
      isSubmitting: false,
      submitError: "Network unavailable",
      showThankYou: false,
    });

    const retry = beginSubmission(failed);
    expect(retry.submitError).toBeNull();
    expect(retry.isSubmitting).toBe(true);

    const completed = completeSubmission(retry, true);
    expect(completed).toEqual({
      isSubmitting: false,
      submitError: null,
      showThankYou: true,
    });
  });
});
