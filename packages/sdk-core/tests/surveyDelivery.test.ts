import { describe, it, expect } from "vitest";
import {
  isSurveyScheduledNow,
  isSurveySuppressed,
  isSurveyTriggerSatisfied,
  selectSurveyForDelivery,
  type SurveyDeliveryCandidate,
} from "../src/utils/surveyDelivery";

function makeSurvey(overrides: Partial<SurveyDeliveryCandidate> = {}): SurveyDeliveryCandidate {
  return {
    _id: "survey-1",
    frequency: "once",
    ...overrides,
  };
}

describe("surveyDelivery", () => {
  it("supports immediate trigger by default", () => {
    const survey = makeSurvey();
    expect(isSurveyTriggerSatisfied(survey, {})).toBe(true);
  });

  it("supports page_visit matching modes", () => {
    const exact = makeSurvey({
      triggers: {
        type: "page_visit",
        pageUrl: "https://app.example.com/pricing",
        pageUrlMatch: "exact",
      },
    });
    const contains = makeSurvey({
      triggers: { type: "page_visit", pageUrl: "/pricing", pageUrlMatch: "contains" },
    });
    const regex = makeSurvey({
      triggers: {
        type: "page_visit",
        pageUrl: "^https://app\\.example\\.com/.+$",
        pageUrlMatch: "regex",
      },
    });

    expect(isSurveyTriggerSatisfied(exact, { currentUrl: "https://app.example.com/pricing" })).toBe(
      true
    );
    expect(isSurveyTriggerSatisfied(exact, { currentUrl: "https://app.example.com/home" })).toBe(
      false
    );
    expect(
      isSurveyTriggerSatisfied(contains, { currentUrl: "https://app.example.com/pricing/monthly" })
    ).toBe(true);
    expect(isSurveyTriggerSatisfied(regex, { currentUrl: "https://app.example.com/home" })).toBe(
      true
    );
  });

  it("supports time_on_page and event triggers", () => {
    const timed = makeSurvey({ triggers: { type: "time_on_page", delaySeconds: 10 } });
    const event = makeSurvey({ triggers: { type: "event", eventName: "checkout_completed" } });

    expect(isSurveyTriggerSatisfied(timed, { timeOnPageSeconds: 5 })).toBe(false);
    expect(isSurveyTriggerSatisfied(timed, { timeOnPageSeconds: 12 })).toBe(true);
    expect(isSurveyTriggerSatisfied(event, { firedEventName: "checkout_started" })).toBe(false);
    expect(isSurveyTriggerSatisfied(event, { firedEventName: "checkout_completed" })).toBe(true);
  });

  it("suppresses shown/completed surveys", () => {
    const survey = makeSurvey({ _id: "survey-123", frequency: "once" });
    expect(
      isSurveySuppressed(survey, {
        shownSurveyIds: new Set(["survey-123"]),
      })
    ).toBe(true);

    expect(
      isSurveySuppressed(survey, {
        completedSurveyIds: new Set(["survey-123"]),
      })
    ).toBe(true);

    expect(
      isSurveySuppressed(survey, {
        sessionShownSurveyIds: new Set(["survey-123"]),
      })
    ).toBe(true);
  });

  it("enforces schedule windows", () => {
    const survey = makeSurvey({
      scheduling: {
        startDate: 1_000,
        endDate: 2_000,
      },
    });

    expect(isSurveyScheduledNow(survey, 999)).toBe(false);
    expect(isSurveyScheduledNow(survey, 1_500)).toBe(true);
    expect(isSurveyScheduledNow(survey, 2_001)).toBe(false);
  });

  it("selects the first survey that satisfies schedule, trigger, and suppression rules", () => {
    const surveys: SurveyDeliveryCandidate[] = [
      makeSurvey({
        _id: "survey-1",
        triggers: { type: "time_on_page", delaySeconds: 20 },
      }),
      makeSurvey({
        _id: "survey-2",
        triggers: { type: "event", eventName: "checkout_completed" },
      }),
      makeSurvey({
        _id: "survey-3",
        triggers: { type: "immediate" },
      }),
    ];

    const selected = selectSurveyForDelivery(
      surveys,
      {
        timeOnPageSeconds: 10,
        firedEventName: "checkout_completed",
      },
      {
        sessionShownSurveyIds: new Set(["survey-2"]),
      }
    );

    expect(selected?._id).toBe("survey-3");
  });
});
