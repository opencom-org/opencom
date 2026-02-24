export type SurveyTriggerType = "immediate" | "page_visit" | "time_on_page" | "event";
export type SurveyFrequency = "once" | "until_completed";
export type PageUrlMatchMode = "exact" | "contains" | "regex";

export interface SurveyTriggerConfig {
  type: SurveyTriggerType;
  pageUrl?: string;
  pageUrlMatch?: PageUrlMatchMode;
  delaySeconds?: number;
  eventName?: string;
}

export interface SurveySchedule {
  startDate?: number;
  endDate?: number;
}

export interface SurveyDeliveryCandidate<TSurveyId extends string = string> {
  _id: TSurveyId;
  createdAt?: number;
  triggers?: SurveyTriggerConfig;
  frequency?: SurveyFrequency;
  scheduling?: SurveySchedule;
}

export interface SurveyDeliveryContext {
  now?: number;
  currentUrl?: string;
  timeOnPageSeconds?: number;
  firedEventName?: string;
}

export interface SurveyDeliveryState {
  shownSurveyIds?: Set<string>;
  completedSurveyIds?: Set<string>;
  sessionShownSurveyIds?: Set<string>;
}

function surveyIdToString(id: string): string {
  return id;
}

function normalizeCurrentUrl(url: string | undefined): string {
  return (url ?? "").trim();
}

function matchesPageRule(
  currentUrl: string,
  pageUrl: string | undefined,
  mode: PageUrlMatchMode | undefined
): boolean {
  if (!pageUrl) {
    return true;
  }

  if (!currentUrl) {
    return false;
  }

  if (mode === "exact") {
    return currentUrl === pageUrl;
  }

  if (mode === "regex") {
    try {
      return new RegExp(pageUrl).test(currentUrl);
    } catch {
      return false;
    }
  }

  return currentUrl.includes(pageUrl);
}

export function isSurveyScheduledNow(
  survey: Pick<SurveyDeliveryCandidate, "scheduling">,
  now = Date.now()
): boolean {
  if (!survey.scheduling) {
    return true;
  }

  const { startDate, endDate } = survey.scheduling;
  if (startDate !== undefined && now < startDate) {
    return false;
  }
  if (endDate !== undefined && now > endDate) {
    return false;
  }
  return true;
}

export function isSurveyTriggerSatisfied(
  survey: Pick<SurveyDeliveryCandidate, "triggers">,
  context: SurveyDeliveryContext
): boolean {
  const trigger = survey.triggers;
  if (!trigger || trigger.type === "immediate") {
    return true;
  }

  if (trigger.type === "page_visit") {
    return matchesPageRule(
      normalizeCurrentUrl(context.currentUrl),
      trigger.pageUrl,
      trigger.pageUrlMatch
    );
  }

  if (trigger.type === "time_on_page") {
    const elapsed = context.timeOnPageSeconds ?? 0;
    return elapsed >= (trigger.delaySeconds ?? 5);
  }

  if (trigger.type === "event") {
    const firedEventName = context.firedEventName;
    if (!firedEventName) {
      return false;
    }
    if (!trigger.eventName) {
      return true;
    }
    return firedEventName === trigger.eventName;
  }

  return false;
}

export function isSurveySuppressed(
  survey: Pick<SurveyDeliveryCandidate, "_id" | "frequency">,
  state: SurveyDeliveryState
): boolean {
  const surveyId = surveyIdToString(survey._id);
  if (state.completedSurveyIds?.has(surveyId)) {
    return true;
  }

  if (state.sessionShownSurveyIds?.has(surveyId)) {
    return true;
  }

  if (survey.frequency === "once" && state.shownSurveyIds?.has(surveyId)) {
    return true;
  }

  return false;
}

export function selectSurveyForDelivery<TSurvey extends SurveyDeliveryCandidate>(
  surveys: TSurvey[],
  context: SurveyDeliveryContext,
  state: SurveyDeliveryState
): TSurvey | null {
  const now = context.now ?? Date.now();
  for (const survey of surveys) {
    if (!isSurveyScheduledNow(survey, now)) {
      continue;
    }
    if (isSurveySuppressed(survey, state)) {
      continue;
    }
    if (!isSurveyTriggerSatisfied(survey, context)) {
      continue;
    }
    return survey;
  }
  return null;
}
